// netlify/functions/admin-activity.js
// GET /api/admin/activity — recent ingest log events
const { preflight, ok, err, getDB } = require('./_shared');
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  try {
    const db = getDB();
    const { data, error } = await db
      .from('ingest_runs')
      .select('started_at, source, articles_fetched, dupes_found, new_clusters, errors, duration_ms')
      .order('started_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    const events = (data || []).map(r => ({
      time: new Date(r.started_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
      text: `${r.source} run complete · ${r.articles_fetched} articles · ${r.dupes_found} dupes · ${r.new_clusters} new clusters${r.errors ? ` · <span style="color:var(--red)">${r.errors} errors</span>` : ''}`
    }));

    return ok({ events });
  } catch (e) { return err(e.message); }
};
