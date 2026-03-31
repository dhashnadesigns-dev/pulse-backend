// GET /api/feed/global
// Returns top stories globally ranked by significance — powers the ticker
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const db = getDB();

    // Get editorial config for email prompt frequency
    const { data: cfg } = await db
      .from('editorial_config')
      .select('ticker_email_freq, ticker_email_copy, ticker_format')
      .eq('id', 'default')
      .single();

    const emailFreq  = cfg?.ticker_email_freq || 5;
    const emailCopy  = cfg?.ticker_email_copy  || 'PULSE PRO · Be first to know →';

    // Top 20 breaking/major stories from last 24h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await db
      .from('clusters')
      .select(`
        id, tier, significance_score,
        cities!clusters_city_id_fkey ( name ),
        articles!clusters_canonical_article_id_fkey ( title )
      `)
      .gte('last_updated_at', since)
      .in('tier', ['breaking', 'major'])
      .order('significance_score', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Build ticker items, inserting email promo slot every Nth item
    const items = [];
    (data || []).forEach((c, i) => {
      if (i > 0 && i % emailFreq === 0) {
        items.push({ type: 'promo', copy: emailCopy });
      }
      items.push({
        type:     'story',
        tier:     c.tier,
        city:     c.cities?.name || '—',
        headline: c.articles?.title || '—'
      });
    });

    return ok({ items });
  } catch (e) {
    return err(e.message);
  }
};
