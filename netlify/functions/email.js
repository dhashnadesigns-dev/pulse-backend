// POST /api/email
// Captures email + session. Writes to DB and sends to Brevo list.
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const { email, session_id } = JSON.parse(event.body || '{}');
  if (!email || !email.includes('@')) return err('Invalid email', 400);

  try {
    const db = getDB();

    // Update session with email
    await db.from('user_signals')
      .update({ email, email_captured_at: new Date().toISOString() })
      .eq('session_id', session_id);

    // Send to Brevo (optional — only if BREVO_API_KEY is set)
    if (process.env.BREVO_API_KEY) {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          listIds: [Number(process.env.BREVO_LIST_ID || 1)],
          updateEnabled: true
        })
      });
    }

    return ok({ ok: true });
  } catch (e) {
    return err(e.message);
  }
};
