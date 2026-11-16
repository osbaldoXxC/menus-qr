'use strict';
// Read-only HTTP checks, intended for the existing isolated R3 test backend.
const assert = require('node:assert/strict');
const base = process.env.SEARCH_TEST_API || 'http://127.0.0.1:4000';
const owner = '10000000-0000-4000-8000-000000000001';
const texts = ['Quiero algo picoso', 'Quiero algo picoso sin puerco', 'Quiero algo dulce como pan, pero tengo 100 pesos', 'Quiero pollo sin cebolla'];
async function main() {
  for (const [scope, path] of [['global', '/api/public/menu/recommendations'], ['restaurant', `/api/public/menu/${owner}/recommendations`]]) {
    for (const [index, text] of texts.entries()) {
      const requestId = `r4-loading-${scope}-${index}`;
      const payload = { craving: { text, tags: [] }, restrictions: {}, options: { limit: 5, locale: 'es-MX', requestId } };
      const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      assert.equal(response.status, 200); assert.equal(body.requestId, requestId);
      assert.ok(['ok', 'partial_results_sanitized', 'no_verified_results'].includes(body.status.code));
      assert.ok(Array.isArray(body.recommendations));
      if (body.status.code === 'no_verified_results') assert.equal(body.recommendations.length, 0);
      if (text === 'Quiero pollo sin cebolla') assert.equal(body.status.code, 'no_verified_results');
      console.log(JSON.stringify({ scope, text, endpoint: path, http: response.status, requestId: body.requestId,
        status: body.status.code, count: body.recommendations.length, unverifiable: body.safety.hasUnverifiableRestrictions }));
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
