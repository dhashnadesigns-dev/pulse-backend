// netlify/functions/admin-cities.js
// POST /api/admin/cities/add    — add a city to tracking
// POST /api/admin/cities/remove — remove a city
const { preflight, ok, err, getDB } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const db   = getDB();
  const body = JSON.parse(event.body || '{}');
  const action = event.path.endsWith('/add') ? 'add' : 'remove';

  try {
    if (action === 'add') {
      // Geocode city name via a free API, or accept lat/lng directly
      // Simple insert — lat/lng can be enriched later by the city rollup job
      const { error } = await db.from('cities').upsert({
        id:          body.name.toLowerCase().replace(/\s+/g, '_'),
        name:        body.name,
        lat:         body.lat  || 0,
        lng:         body.lng  || 0,
        story_count: 0,
        tier:        'standard'
      }, { onConflict: 'id' });
      if (error) throw error;
      return ok({ added: body.name });
    }

    if (action === 'remove') {
      const id = body.name.toLowerCase().replace(/\s+/g, '_');
      const { error } = await db.from('cities').delete().eq('id', id);
      if (error) throw error;
      return ok({ removed: body.name });
    }
  } catch (e) { return err(e.message); }
};
