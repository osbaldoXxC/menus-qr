'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:4000/api/public/menu';
const urls = [`${base}/recommendations`, `${base}/10000000-0000-4000-8000-000000000001/recommendations`];
async function query(url, text) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ craving: { text } }) });
  assert.equal(r.status, 200); return r.json();
}
test('R3 real ML: natural preferences and restrictions on both endpoints', async () => {
  for (const url of urls) {
    const spicy = await query(url, 'Quiero algo picoso');
    assert.ok(spicy.recommendations.length > 0);
    for (const text of ['Quiero algo sin cerdo', 'Quiero pollo sin cebolla', 'Quiero algo vegetariano', 'Tengo alergia a cacahuate', 'Quiero tacos por 100 pesos']) {
      const result = await query(url, text);
      assert.equal(result.status.code, 'no_verified_results', text);
      assert.deepEqual(result.recommendations, []);
    }
    const budget = await query(url, 'Tengo 100 pesos para comer');
    assert.ok(!budget.recommendations.some(r => r.dish.price > 100));
    assert.ok(budget.recommendations.every(r => r.safety.restrictions.some(x => x.type === 'budget')));
  }
});
