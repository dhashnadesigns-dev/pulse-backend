// GET /api/cities/:id/nearby
// Returns nearby cities ranked by story density (not just geographic distance)
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const cityId = event.path.split('/')[3];

  try {
    const db = getDB();

    // Get this city's lat/lng
    const { data: city } = await db
      .from('cities')
      .select('lat, lng')
      .eq('id', cityId)
      .single();

    if (!city) return ok({ cities: [] });

    // Get nearby cities within ~15 degrees that have stories, sorted by story count
    const { data, error } = await db
      .from('cities')
      .select('id, name, lat, lng, tier, dot_intensity, story_count')
      .neq('id', cityId)
      .gt('story_count', 0)
      .gte('lat', city.lat - 15).lte('lat', city.lat + 15)
      .gte('lng', city.lng - 15).lte('lng', city.lng + 15)
      .order('story_count', { ascending: false })
      .limit(5);

    if (error) throw error;
    return ok({ cities: data || [] });
  } catch (e) {
    return err(e.message);
  }
};
