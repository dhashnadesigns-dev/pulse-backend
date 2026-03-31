// GET /api/cities/:id/stories?range=24h
// Returns ranked story clusters for a city panel
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  // Extract city id from path: /api/cities/cairo_eg/stories
  const cityId = event.path.split('/')[3];
  const range  = event.queryStringParameters?.range || '24h';

  // Map range to hours
  const hours = { '6h':6, '24h':24, '7d':168, '30d':720 }[range] || 24;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  try {
    const db = getDB();
    const { data, error } = await db
      .from('clusters')
      .select(`
        id, tier, significance_score, story_count,
        last_updated_at, first_seen_at,
        articles!clusters_canonical_article_id_fkey (
          title, subtext, url, source_name
        )
      `)
      .eq('city_id', cityId)
      .gte('last_updated_at', since)
      .order('significance_score', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Flatten into the shape the frontend expects
    const stories = (data || []).map(c => ({
      id:               c.id,
      tier:             c.tier,
      title:            c.articles?.title      || 'No title',
      desc:             c.articles?.subtext    || '',  // AI-written subtext
      src:              c.articles?.source_name|| 'PULSE',
      url:              c.articles?.url        || '#',
      source_count:     c.story_count,
      updated_mins_ago: Math.round((Date.now() - new Date(c.last_updated_at)) / 60000)
    }));

    return ok({ stories });
  } catch (e) {
    return err(e.message);
  }
};
