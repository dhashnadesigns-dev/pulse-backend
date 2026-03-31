// netlify/functions/admin-jobs.js
// GET  /api/admin/jobs           — list job statuses
// POST /api/admin/jobs/:name/run — manually trigger a job
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const db = getDB();

  try {
    // Manual trigger
    if (event.httpMethod === 'POST') {
      const jobName = event.path.split('/')[4]; // e.g. "ingest"
      // Each job is a separate scheduled function — triggering it means
      // calling its handler directly or via Netlify's trigger API.
      // For now we log the trigger request and return success.
      await db.from('ingest_runs').insert({
        source:           jobName,
        started_at:       new Date().toISOString(),
        articles_fetched: 0,
        dupes_found:      0,
        new_clusters:     0,
        manual_trigger:   true
      });
      return ok({ triggered: jobName });
    }

    // List recent run per job type
    const { data, error } = await db
      .from('ingest_runs')
      .select('source, started_at, duration_ms, errors')
      .order('started_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    // Collapse to latest run per source
    const seen = {};
    (data || []).forEach(r => { if (!seen[r.source]) seen[r.source] = r; });

    const JOB_DEFS = [
      { name: 'Ingest',          cadence: 'every 5 min',  key: 'ingest' },
      { name: 'Normalise',       cadence: 'on trigger',   key: 'normalise' },
      { name: 'Editorial agent', cadence: 'on trigger',   key: 'editorial' },
      { name: 'Change events',   cadence: 'on trigger',   key: 'change_events' },
      { name: 'City rollup',     cadence: 'every 1 hr',   key: 'city_rollup' },
      { name: 'Analytics',       cadence: 'daily',        key: 'analytics' },
    ];

    const jobs = JOB_DEFS.map(j => {
      const last = seen[j.key];
      return {
        name:     j.name,
        cadence:  j.cadence,
        last_run: last ? timeAgo(last.started_at) : 'never',
        duration: last ? `${(last.duration_ms / 1000).toFixed(1)}s` : '—',
        status:   last ? (last.errors ? 'ERROR' : 'OK') : 'unknown'
      };
    });

    return ok({ jobs });
  } catch (e) { return err(e.message); }
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins/60)} hr ago`;
}
