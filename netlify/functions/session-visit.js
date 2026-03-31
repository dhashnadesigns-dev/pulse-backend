// POST /api/session/:id/visit
// Records a city visit. Returns { show_email_prompt: bool }
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const sessionId = decodeURIComponent(event.path.split('/')[4]);
  const body = JSON.parse(event.body || '{}');
  const { cityId, tier, range, ts } = body;

  try {
    const db = getDB();

    // Upsert session record
    const { data: existing } = await db
      .from('user_signals')
      .select('id, visited_city_ids, email')
      .eq('session_id', sessionId)
      .single();

    const visited = existing?.visited_city_ids || [];
    if (!visited.includes(cityId)) visited.push(cityId);

    await db.from('user_signals').upsert({
      session_id:        sessionId,
      visited_city_ids:  visited,
      last_seen_at:      ts || new Date().toISOString()
    }, { onConflict: 'session_id' });

    // Show email prompt after 3 unique city visits, if not already captured
    const show_email_prompt = visited.length >= 3 && !existing?.email;

    return ok({ show_email_prompt, cities_visited: visited.length });
  } catch (e) {
    return err(e.message);
  }
};
