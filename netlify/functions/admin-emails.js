// netlify/functions/admin-emails.js
// GET    /api/admin/emails      — list captured emails
// DELETE /api/admin/emails/:id  — remove one email
const { preflight, ok, err, getDB } = require('./_shared');
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const db = getDB();

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await db
        .from('user_signals')
        .select('id, email, visited_city_ids, email_captured_at, referrer')
        .not('email', 'is', null)
        .order('email_captured_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const emails = (data || []).map(r => ({
        id:          r.id,
        email:       r.email.replace(/(?<=.).(?=[^@]*@)/g, '*'), // mask
        cities:      r.visited_city_ids || [],
        captured_at: r.email_captured_at
          ? new Date(r.email_captured_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) + ' today'
          : '—',
        referrer: r.referrer || 'Direct'
      }));
      return ok({ emails });
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.path.split('/').pop();
      const { error } = await db
        .from('user_signals')
        .update({ email: null, email_captured_at: null })
        .eq('id', id);
      if (error) throw error;
      return ok({ ok: true });
    }

    return err('Method not allowed', 405);
  } catch (e) { return err(e.message); }
};
