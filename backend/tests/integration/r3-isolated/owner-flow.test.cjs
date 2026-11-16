'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = '10000000-0000-4000-8000-000000000001';
const root = 'http://127.0.0.1:4000';
async function request(path, body, token, method = 'POST') {
  const response = await fetch(root + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
test('R3/R4 real owner HTTP: edit price, reconfirm, budget, revoke', async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db, 'r3_test_isolated');
  const login = await request('/api/auth/login', { email: 'uno@example.invalid', password: 'Synthetic-only-123!' });
  assert.equal(login.status, 200); const token = login.body.access_token;
  const id = randomUUID();
  await pool.query(`INSERT INTO platillos(id,restaurante_id,nombre,precio,activo,ingredientes_principales)
    VALUES($1,$2,'Flujo sintetico',50,true,'["pollo"]')`, [id, owner]);
  const inspect = async () => (await request(`/api/menu/platillos/${id}/evidence`, null, token, 'GET')).body;
  const confirm = s => request('/api/menu/evidence/currency', { currency: 'MXN', source: 'Prueba de flujo sintetico',
    catalogFingerprint: s.catalogFingerprint, dishes: [{ id, price: String(s.dish.precio), priceRevision: s.dish.evidencia_precio_revision }] }, token);
  const eligible = async () => {
    const result = await request(`/api/public/menu/${owner}/recommendations`, { restrictions: { budgetMax: 100 } });
    assert.equal(result.status, 200); return result.body.recommendations.some(r => r.dish.id === id);
  };
  let snapshot = await inspect(); assert.equal((await confirm(snapshot)).status, 200); assert.equal(await eligible(), true);
  for (const path of ['/api/public/menu/recommendations', `/api/public/menu/${owner}/recommendations`]) {
    const textBudget = await request(path, { craving: { text: 'Tengo 100 pesos para comer' } });
    assert.equal(textBudget.status, 200);
    const item = textBudget.body.recommendations.find(r => r.dish.id === id);
    assert.ok(item, JSON.stringify(textBudget.body));
    assert.ok(item.safety.restrictions.some(r => r.type === 'budget'));
    assert.ok(textBudget.body.recommendations.every(r => r.dish.price <= 100));
  }
  const edit = await request(`/api/menu/platillos/${id}`, { precio: 80 }, token, 'PUT');
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(await eligible(), false);
  const stale = await confirm(snapshot); assert.equal(stale.status, 409);
  snapshot = await inspect(); assert.equal(snapshot.currencyState, 'unknown');
  const confirmed = await confirm(snapshot); assert.equal(confirmed.status, 200);
  assert.equal(await eligible(), true);
  assert.equal((await request(`/api/menu/evidence/currency/${confirmed.body.id}/revoke`, { reason: 'Synthetic flow' }, token)).status, 200);
  assert.equal(await eligible(), false);
});
test.after(async () => pool.end());
