// GET /api/cities
// Returns all active cities with tier + dot_intensity for the globe
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const db = getDB();
    const { data, error } = await db
      .from('cities')
      .select('id, name, lat, lng, tier, dot_intensity, story_count, last_story_at')
      .gt('story_count', 0)
      .order('story_count', { ascending: false });

    if (error) throw error;
    return ok(data || []);
  } catch (e) {
    return err(e.message);
  }
};
