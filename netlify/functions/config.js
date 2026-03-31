// GET /api/config
// Returns dashboard-controlled config values consumed by the frontend
const { preflight, ok, err, getDB } = require('./_shared');

const DEFAULTS = {
  ticker_speed:       55,
  ticker_pause_hover: true,
  ticker_breaking_hl: true,
  ticker_max_items:   15,
  ticker_email_freq:  5,
  ticker_format:      'City · Headline snippet',
  ticker_email_copy:  'PULSE PRO COMING SOON · Be first to know →',
  subtext_style:      'Analytical',
  features: {
    nearby_chips:   true,
    email_capture:  true,
    live_feed:      true
  }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const db = getDB();
    const { data } = await db
      .from('editorial_config')
      .select('*')
      .eq('id', 'default')
      .single();

    // Merge DB values over defaults so frontend always gets a full config
    const config = { ...DEFAULTS, ...(data || {}) };
    return ok(config);
  } catch (e) {
    // Always return defaults even if DB is unreachable
    return ok(DEFAULTS);
  }
};
