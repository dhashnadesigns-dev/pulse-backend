// netlify/functions/admin-sources.js
// GET /api/admin/sources — source connector health stats
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  try {
    const db = getDB();
    const since = new Date(Date.now() - 86400000).toISOString();

    const { data, error } = await db
      .from('ingest_runs')
      .select('source, articles_fetched, errors, started_at, duration_ms')
      .gte('started_at', since)
      .order('started_at', { ascending: false });
    if (error) throw error;

    // Aggregate per source
    const map = {};
    (data || []).forEach(r => {
      if (!map[r.source]) map[r.source] = { runs:0, articles:0, errors:0, last_run: r.started_at };
      map[r.source].runs++;
      map[r.source].articles += r.articles_fetched || 0;
      map[r.source].errors   += r.errors ? 1 : 0;
    });

    const sources = Object.entries(map).map(([name, s]) => ({
      name,
      runs_24h:     s.runs,
      avg_articles: s.runs ? Math.round(s.articles / s.runs) : 0,
      error_rate:   s.runs ? ((s.errors / s.runs) * 100).toFixed(1) : '0.0',
      last_run:     timeAgo(s.last_run)
    }));

    return ok({ sources });
  } catch (e) { return err(e.message); }
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins/60)} hr ago`;
}
