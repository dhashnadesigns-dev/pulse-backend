// netlify/functions/admin-config.js
// GET  /api/admin/config  — load config into dashboard form
// POST /api/admin/config  — save dashboard form to DB (then /api/config picks it up)
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const db = getDB();

  try {
    if (event.httpMethod === 'GET') {
      const { data } = await db
        .from('editorial_config')
        .select('*')
        .eq('id', 'default')
        .single();
      return ok(data || {});
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      await db.from('editorial_config')
        .upsert({ id: 'default', ...body, updated_at: new Date().toISOString() },
                 { onConflict: 'id' });
      return ok({ ok: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
