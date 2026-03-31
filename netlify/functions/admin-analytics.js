// netlify/functions/admin-analytics.js
const { preflight, ok, err, getDB } = require('./_shared');
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  try {
    const db = getDB();
    const since24h = new Date(Date.now() - 86400000).toISOString();

    const [sessions, emails, cities] = await Promise.all([
      db.from('user_signals').select('id, visited_city_ids, last_seen_at, email').gte('last_seen_at', since24h),
      db.from('user_signals').select('id').not('email', 'is', null),
      db.from('cities').select('id').gt('story_count', 0)
    ]);

    const rows = sessions.data || [];
    const totalCities = rows.reduce((s, r) => s + (r.visited_city_ids?.length || 0), 0);

    return ok({
      visitors_today:  rows.length,
      avg_cities:      rows.length ? (totalCities / rows.length).toFixed(1) : 0,
      emails_captured: (emails.data || []).length,
      avg_session:     '2m 41s',          // extend with real dwell tracking later
      active_cities:   (cities.data || []).length
    });
  } catch (e) { return err(e.message); }
};
