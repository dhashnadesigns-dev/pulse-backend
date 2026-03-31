// netlify/functions/ingest.js
// Scheduled function — runs every 5 minutes via netlify.toml cron
// Pulls from GDELT, normalises, scores, writes to DB
// Add to netlify.toml:
//   [functions.ingest]
//     schedule = "*/5 * * * *"

const { getDB } = require('./_shared');

exports.handler = async () => {
  const db      = getDB();
  const startAt = Date.now();
  let articlesIn = 0, dupes = 0, newClusters = 0;

  try {
    // ── 1. Fetch from GDELT ──────────────────────────────────────────────────
    const gdeltUrl = [
      'https://api.gdeltproject.org/api/v2/doc/doc',
      '?query=sourcelang:english',
      '&mode=artlist',
      '&maxrecords=250',
      '&format=json',
      '&timespan=15min'
    ].join('');

    const raw  = await fetch(gdeltUrl).then(r => r.json()).catch(() => ({ articles: [] }));
    const arts = raw.articles || [];
    articlesIn = arts.length;

    // ── 2. Normalise each article ────────────────────────────────────────────
    for (const art of arts) {
      const url = art.url;
      if (!url) continue;

      // Skip if URL already exists (exact dedup)
      const { data: existing } = await db
        .from('articles')
        .select('id')
        .eq('url', url)
        .single();
      if (existing) { dupes++; continue; }

      // Geo-tag: use GDELT's location field or fall back to country
      const cityId = resolveCity(art);
      if (!cityId) continue;

      // Insert article
      await db.from('articles').insert({
        title:       art.title,
        url,
        source_name: art.domain,
        published_at:art.seendate ? parseGdeltDate(art.seendate) : new Date().toISOString(),
        city_id:     cityId,
        lang:        art.language || 'en',
        raw_tone:    art.tone ? parseFloat(art.tone) : 0
      });

      // ── 3. Cluster + score ─────────────────────────────────────────────────
      const clusterId = await upsertCluster(db, cityId, art);
      if (clusterId === 'new') newClusters++;
    }

    // ── 4. Update city state (top tier, dot_intensity) ───────────────────────
    await rollupCities(db);

    // ── 5. Log the run ───────────────────────────────────────────────────────
    await db.from('ingest_runs').insert({
      source:           'gdelt',
      started_at:       new Date(startAt).toISOString(),
      articles_fetched: articlesIn,
      dupes_found:      dupes,
      new_clusters:     newClusters,
      duration_ms:      Date.now() - startAt,
      errors:           null
    });

    return { statusCode: 200, body: JSON.stringify({ articlesIn, dupes, newClusters }) };
  } catch (e) {
    await db.from('ingest_runs').insert({
      source: 'gdelt', started_at: new Date(startAt).toISOString(),
      articles_fetched: articlesIn, dupes_found: dupes, new_clusters: newClusters,
      duration_ms: Date.now() - startAt, errors: e.message
    }).catch(() => {});
    return { statusCode: 500, body: e.message };
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveCity(art) {
  // GDELT provides location strings — map common ones to city IDs
  // Extend this map as coverage grows
  const loc = (art.locations || [{ name: art.sourcecountry }])[0]?.name || '';
  const text = (art.title + ' ' + loc).toLowerCase();

  const MAP = {
    cairo: 'cairo_eg', kyiv: 'kyiv_ua', tokyo: 'tokyo_jp',
    london: 'london_gb', berlin: 'berlin_de', paris: 'paris_fr',
    moscow: 'moscow_ru', beijing: 'beijing_cn', mumbai: 'mumbai_in',
    'new york': 'new_york_us', washington: 'washington_us',
    istanbul: 'istanbul_tr', tehran: 'tehran_ir', riyadh: 'riyadh_sa',
    nairobi: 'nairobi_ke', lagos: 'lagos_ng', seoul: 'seoul_kr',
    bangkok: 'bangkok_th', jakarta: 'jakarta_id', manila: 'manila_ph'
  };

  for (const [key, id] of Object.entries(MAP)) {
    if (text.includes(key)) return id;
  }
  return null;
}

async function upsertCluster(db, cityId, art) {
  // Look for an existing cluster for this city updated in the last 2 hours
  const since = new Date(Date.now() - 7200000).toISOString();
  const { data: existing } = await db
    .from('clusters')
    .select('id, story_count, significance_score')
    .eq('city_id', cityId)
    .gte('last_updated_at', since)
    .order('significance_score', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    // Increment story count and recalculate score
    const newCount = existing.story_count + 1;
    const newScore = scoreCluster(newCount, existing.significance_score);
    await db.from('clusters').update({
      story_count:        newCount,
      significance_score: newScore,
      tier:               tierFromScore(newScore),
      last_updated_at:    new Date().toISOString()
    }).eq('id', existing.id);
    return 'updated';
  }

  // Create new cluster
  const score = scoreCluster(1, 0);
  await db.from('clusters').insert({
    city_id:            cityId,
    story_count:        1,
    significance_score: score,
    tier:               tierFromScore(score),
    first_seen_at:      new Date().toISOString(),
    last_updated_at:    new Date().toISOString()
  });
  return 'new';
}

function scoreCluster(storyCount, prevScore) {
  // Simple significance formula — extend with velocity, source diversity etc.
  const base = Math.min(storyCount * 12, 60);        // volume: max 60pts
  const carry = prevScore * 0.3;                      // momentum carry
  return Math.min(Math.round(base + carry), 100);
}

function tierFromScore(score) {
  if (score >= 80) return 'breaking';
  if (score >= 40) return 'major';
  return 'standard';
}

async function rollupCities(db) {
  // For each city, set top_tier = highest tier cluster active in last 48h
  const since = new Date(Date.now() - 172800000).toISOString();
  const { data: clusters } = await db
    .from('clusters')
    .select('city_id, tier, significance_score, story_count')
    .gte('last_updated_at', since);

  const cityMap = {};
  (clusters || []).forEach(c => {
    if (!cityMap[c.city_id] || c.significance_score > (cityMap[c.city_id].score || 0)) {
      cityMap[c.city_id] = { tier: c.tier, score: c.significance_score, count: c.story_count };
    }
  });

  for (const [cityId, vals] of Object.entries(cityMap)) {
    await db.from('cities').update({
      tier:          vals.tier,
      dot_intensity: Math.min(vals.score / 100, 1),
      story_count:   vals.count,
      last_story_at: new Date().toISOString()
    }).eq('id', cityId);
  }
}

function parseGdeltDate(s) {
  // GDELT format: 20260323143000 → ISO
  if (s.length < 14) return new Date().toISOString();
  return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`).toISOString();
}
