// netlify/functions/_shared.js
// Shared by every function — CORS headers + DB client

const { createClient } = require('@supabase/supabase-js');

// ─── CORS ────────────────────────────────────────────────────────────────────
// Allow requests from your frontend domain.
// Set FRONTEND_URL in Netlify env vars, e.g. https://pulse-newsradar.netlify.app
const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function preflight() {
  return { statusCode: 204, headers: CORS, body: '' };
}

function ok(data) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
}

function err(msg, code = 500) {
  return { statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) };
}

// ─── Supabase client ─────────────────────────────────────────────────────────
// Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Netlify env vars
function getDB() {
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

module.exports = { CORS, preflight, ok, err, getDB };
