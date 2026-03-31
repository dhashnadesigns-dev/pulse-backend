// netlify/functions/admin-keys.js
// POST /api/admin/keys — save an external API key to Netlify env (via Netlify API)
// NOTE: Netlify doesn't allow updating env vars at runtime via functions directly.
// This stores keys in the DB (encrypted). The ingest job reads them from there.
const { preflight, ok, err, getDB } = require('./_shared');

const ALLOWED_KEYS = ['claude_api_key', 'brevo_api_key', 'newsapi_key'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const { key, value } = JSON.parse(event.body || '{}');
  if (!ALLOWED_KEYS.includes(key)) return err('Unknown key name', 400);
  if (!value) return err('Value required', 400);

  try {
    const db = getDB();
    await db.from('api_keys').upsert(
      { key_name: key, key_value: value, updated_at: new Date().toISOString() },
      { onConflict: 'key_name' }
    );
    return ok({ saved: key });
  } catch (e) { return err(e.message); }
};
