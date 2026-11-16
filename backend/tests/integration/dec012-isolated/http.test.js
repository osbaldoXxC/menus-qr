'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:4000/api/public/menu';
const globalUrl = `${base}/recommendations`;
const fallback = 'http://backend-fallback:4000/api/public/menu';
const r1 = '10000000-0000-4000-8000-000000000001';
const r2 = '10000000-0000-4000-8000-000000000002';
const empty = '10000000-0000-4000-8000-000000000003';
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { http: r.status, body: await r.json() };
}
function envelope(body) {
  assert.deepEqual(Object.keys(body).sort(), ['error','meta','recommendations','requestId','safety','status']);
}
test('health con PostgreSQL real', async () => {
  const r = await fetch('http://127.0.0.1:4000/health'); const b = await r.json();
  assert.equal(r.status, 200); assert.equal(b.database, 'connected');
});
test('ambas rutas: defaults, ML real, datos de PostgreSQL y scope', async () => {
  for (const [url, expected] of [[globalUrl, 'global'], [`${base}/${r1}/recommendations`, 'restaurant']]) {
    const { http, body } = await post(url, { craving: { text: '', tags: [] } });
    assert.equal(http, 200); envelope(body); assert.match(body.requestId, /^req_/); assert.equal(body.meta.limitApplied, 5);
    assert.equal(body.meta.scope.type, expected); assert.equal(body.meta.mlUsed, true); assert.equal(body.meta.fallback, false);
    assert.equal(body.error, null); assert.ok(body.recommendations.length);
    if (expected === 'restaurant') {
      assert.ok(body.recommendations.every(x => x.dish.restaurantId === r1 && x.restaurant.id === r1));
      assert.ok(!body.recommendations.some(x => x.dish.restaurantId === r2));
      const item = body.recommendations.find(x => x.dish.name === 'Taco sintetico');
      assert.ok(item); assert.equal(item.dish.price, 37.5); assert.deepEqual(item.dish.ingredients, ['frijol']);
      assert.equal(item.dish.category, 'Categoria Sintetica'); assert.equal(item.safety.overall, 'compatible_segun_datos');
      const missing = body.recommendations.find(x => x.dish.name === 'Dato ausente'); assert.ok(missing);
      for (const key of ['description','imageUrl','category','ingredients','dietaryTags']) assert.equal(Object.hasOwn(missing.dish,key), false, key);
      assert.ok(!body.recommendations.some(x => x.dish.name === 'Inactivo'));
    }
  }
});
test('ambas rutas: campos desconocidos, limite y locale invalidos', async () => {
  for (const url of [globalUrl, `${base}/${r1}/recommendations`]) for (const body of [{ restrictions: { intruso: true } }, { options: { limit: 11 } }, { options: { locale: '!!!' } }]) {
    const res = await post(url, body); assert.equal(res.http, 400); envelope(res.body); assert.equal(res.body.error.code, 'INVALID_REQUEST');
  }
});
test('ambas rutas: limite 10, locale valido y requestId propagado', async () => {
  for (const url of [globalUrl, `${base}/${r1}/recommendations`]) {
    const res = await post(url, { options: { limit: 10, locale: 'es-MX', requestId: 'dec012-integration' } });
    assert.equal(res.http, 200); assert.equal(res.body.requestId, 'dec012-integration'); assert.equal(res.body.meta.limitApplied, 10);
  }
});
test('sin candidatos y alergia sin evidencia no devuelven resultados verificables', async () => {
  for (const [url, body] of [[`${base}/${empty}/recommendations`, {}], [`${base}/${r1}/recommendations`, { restrictions: { allergies: ['leche'] } }], [globalUrl, { restrictions: { allergies: ['leche'] } }]]) {
    const res = await post(url, body); assert.equal(res.http, 200); assert.deepEqual(res.body.recommendations, []);
    assert.equal(res.body.status.code, 'no_verified_results'); assert.equal(res.body.safety.overall, 'sin_resultados_verificables');
  }
});
test('aislamiento por restaurante: no aparecen ids del otro restaurante', async () => {
  const a = await post(`${base}/${r1}/recommendations`, {}); const b = await post(`${base}/${r2}/recommendations`, {});
  assert.ok(a.body.recommendations.length && b.body.recommendations.length);
  assert.ok(a.body.recommendations.every(x => x.dish.restaurantId === r1)); assert.ok(b.body.recommendations.every(x => x.dish.restaurantId === r2));
  assert.ok(!a.body.recommendations.some(x => x.dish.id === '30000000-0000-4000-8000-000000000002'));
});
test('ML caido: fallback determinista solo elegibles, mlUsed falso; alergia sigue fail-closed', async () => {
  const normal = await post(`${fallback}/${r1}/recommendations`, {});
  assert.equal(normal.http, 200); assert.equal(normal.body.meta.fallback, true); assert.equal(normal.body.meta.mlUsed, false);
  assert.ok(normal.body.recommendations.length); assert.ok(normal.body.recommendations.every(x => x.dish.restaurantId === r1));
  assert.match(normal.body.recommendations[0].reasons[0].text, /no es confianza de ML/);
  const restricted = await post(`${fallback}/${r1}/recommendations`, { restrictions: { allergies: ['leche'] } });
  assert.equal(restricted.http, 200); assert.equal(restricted.body.status.code, 'no_verified_results'); assert.deepEqual(restricted.body.recommendations, []);
});


test('ML caido: una restriccion en texto libre no desaparece', async () => {
  for (const url of [fallback + '/recommendations', `${fallback}/${r1}/recommendations`]) {
    const res = await post(url, { craving: { text: 'alergia a la leche' } });
    assert.equal(res.http, 200); assert.equal(res.body.status.code, 'no_verified_results');
    assert.deepEqual(res.body.recommendations, []); assert.equal(res.body.safety.hasUnverifiableRestrictions, true);
  }
});


test('DEC-002 validacion HTTP de presupuesto en ambos endpoints', async () => {
  for (const url of [globalUrl, `${base}/${r1}/recommendations`]) {
    for (const restrictions of [{ budgetCurrency: 'USD' }, { budgetPerPerson: true }, { budgetMax: 0 }, { budgetMax: -1 }, { budgetMax: 100000.01 }, { budgetMax: 3.141 }, { budgetMax: '10' }, { budgetMax: {} }]) {
      const res = await post(url, { restrictions });
      assert.equal(res.http, 400, JSON.stringify(restrictions)); assert.equal(res.body.error.code, 'INVALID_REQUEST');
    }
    for (const restrictions of [{ budgetMax: 37.5 }, { budgetMax: 37.5, budgetCurrency: 'MXN' }, { budgetMax: 100000, budgetPerPerson: false }]) {
      const res = await post(url, { restrictions });
      assert.equal(res.http, 200); assert.equal(res.body.status.code, 'no_verified_results');
      assert.equal(res.body.safety.hasUnverifiableRestrictions, true); assert.deepEqual(res.body.recommendations, []);
    }
  }
});

test('DEC-002 al caer ML presupuesto no relaja filtro y no cruza restaurantes', async () => {
  for (const url of [fallback + '/recommendations', `${fallback}/${r1}/recommendations`, `${fallback}/${r2}/recommendations`]) {
    const res = await post(url, { restrictions: { budgetMax: 50 } });
    assert.equal(res.http, 200); assert.equal(res.body.status.code, 'no_verified_results'); assert.equal(res.body.meta.mlUsed, false);
    assert.deepEqual(res.body.recommendations, []);
  }
});


test('sin presupuesto: preferencia textual no exige moneda y devuelve candidatos', async () => {
  for (const url of [globalUrl, `${base}/${r1}/recommendations`]) {
    const res = await post(url, { craving: { text: 'Quiero algo picoso' } });
    assert.equal(res.http, 200); assert.ok(res.body.recommendations.length > 0);
    assert.equal(res.body.meta.limitApplied, 5); assert.equal(res.body.meta.mlUsed, true);
    assert.ok(res.body.recommendations.every(item => !item.safety.restrictions.some(r => r.type === 'budget')));
  }
});

test('sin presupuesto: exclusion textual no verificada falla en cerrado en ambas rutas', async () => {
  const text = 'Quiero algo picoso, pero que no tenga puerco';
  const ml = await post('http://ml:8000/interpret', { craving: { text } });
  assert.equal(ml.http, 200); assert.ok(ml.body.extracted.excludedIngredients.includes('puerco'));
  assert.ok(ml.body.extracted.preferences.includes('picoso'));
  for (const url of [globalUrl, `${base}/${r1}/recommendations`]) {
    const res = await post(url, { craving: { text } });
    assert.equal(res.http, 200); assert.deepEqual(res.body.recommendations, []);
    assert.equal(res.body.status.code, 'no_verified_results'); assert.equal(res.body.safety.hasUnverifiableRestrictions, true);
    assert.equal(res.body.meta.limitApplied, 5);
  }
});


test('exclusiones naturales no verificadas y mezcla estructurada no se relajan', async () => {
  for (const text of ['Quiero algo picoso sin cerdo', 'Quiero pollo, sin cebolla']) {
    for (const url of [globalUrl, `${base}/${r1}/recommendations`]) {
      const res = await post(url, { craving: { text } });
      assert.equal(res.http, 200); assert.equal(res.body.status.code, 'no_verified_results', text);
      assert.deepEqual(res.body.recommendations, []);
    }
  }
  for (const url of [globalUrl, `${base}/${r1}/recommendations`]) {
    const res = await post(url, { craving: { text: 'Quiero pollo, sin cebolla' }, restrictions: { excludedIngredients: ['puerco'] } });
    assert.equal(res.http, 200); assert.equal(res.body.status.code, 'no_verified_results');
    assert.deepEqual(res.body.recommendations, []);
  }
});
