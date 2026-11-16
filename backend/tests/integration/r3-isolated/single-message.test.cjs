'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = '10000000-0000-4000-8000-000000000001';
async function call(path, body, token, method = 'POST') {
  const r = await fetch('http://127.0.0.1:4000' + path, { method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, body: await r.json() };
}
test('R4 single-message requests retain budget and exclusion with real ML and PostgreSQL', async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db, 'r3_test_isolated');
  const login = await call('/api/auth/login', { email: 'uno@example.invalid', password: 'Synthetic-only-123!' });
  assert.equal(login.status, 200); const token = login.body.access_token; const id = randomUUID();
  await pool.query(`INSERT INTO platillos (id,restaurante_id,nombre,precio,activo,ingredientes_principales,nivel_picante)
    VALUES ($1,$2,'Pan y pollo sintetico',50,true,'["pollo","chile"]',2)`, [id, owner]);
  const snapshot = await call(`/api/menu/platillos/${id}/evidence`, null, token, 'GET'); assert.equal(snapshot.status, 200);
  const price = await call('/api/menu/evidence/currency', { currency: 'MXN', source: 'Revision sintetica',
    catalogFingerprint: snapshot.body.catalogFingerprint, dishes: [{ id, price: snapshot.body.dish.precio,
      priceRevision: snapshot.body.dish.evidencia_precio_revision }] }, token); assert.equal(price.status, 200);
  const taxonomy = snapshot.body.evidence.taxonomy.find(t => t.grupo === 'cerdo'); assert.ok(taxonomy);
  const keys = ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos','sustituciones_permitidas','modificadores_opcionales'];
  const absence = await call(`/api/menu/platillos/${id}/evidence/absence`, { source: 'Receta sintetica revisada',
    recipeVersion: snapshot.body.recipeVersion, recipeRevision: snapshot.body.dish.evidencia_receta_revision,
    group: 'cerdo', taxonomyVersion: taxonomy.version, taxonomyRevision: taxonomy.revision,
    sections: Object.fromEntries(keys.map(k => [k, 'complete'])) }, token); assert.equal(absence.status, 200, JSON.stringify(absence.body));
  for (const path of ['/api/public/menu/recommendations', `/api/public/menu/${owner}/recommendations`]) {
    for (const text of ['Quiero algo dulce como pan, pero solo tengo 100 pesos', 'Quiero algo picoso sin puerco, y tengo 100 pesos']) {
      const response = await call(path, { craving: { text }, options: { limit: 10 } });
      assert.equal(response.status, 200); const item = response.body.recommendations.find(r => r.dish.id === id);
      assert.ok(item, `${text}: ${JSON.stringify(response.body)}`);
      assert.equal(item.safety.priceVerified, true);
      assert.ok(item.safety.restrictions.some(r => r.type === 'budget'));
      if (text.includes('puerco')) assert.ok(item.safety.restrictions.some(r => r.type === 'exclusion'));
      assert.ok(response.body.recommendations.every(r => r.dish.price <= 100));
    }
    const unrestricted = await call(path, { craving: { text: 'Quiero algo picoso' }, options: { limit: 10 } });
    const unverified = unrestricted.body.recommendations.find(r => r.dish.id === '30000000-0000-4000-8000-000000000003');
    assert.ok(unverified); assert.equal(unverified.safety.priceVerified, false);
  }
});
test.after(async () => pool.end());
