// netlify/functions/admin-sessions.js
// GET /api/admin/sessions — recent user sessions for the dashboard
const { preflight, ok, err, getDB } = require('./_shared');
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  try {
    const db = getDB();
    const { data, error } = await db
      .from('user_signals')
      .select('session_id, visited_city_ids, referrer, email, device_type, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const sessions = (data || []).map(s => ({
      id:       s.session_id,
      cities:   s.visited_city_ids || [],
      referrer: s.referrer || 'Direct',
      email:    s.email || null,
      device:   s.device_type || '—'
    }));

    return ok({ sessions });
  } catch (e) { return err(e.message); }
};
