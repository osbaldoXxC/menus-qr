'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = randomUUID();
const email = `single-message-${owner}@example.invalid`;
const password = 'Synthetic-only-123!';
const root = process.env.R3_SINGLE_BACKEND_URL || 'http://127.0.0.1:4000';
async function call(path, body, token, method = 'POST') {
  const r = await fetch(root + path, { method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, body: await r.json() };
}
test('R4 single-message requests retain budget and exclusion with real ML and PostgreSQL', async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db, 'r3_test_isolated');
  await pool.query(`INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,rol,estado,suscripcion_activa,email_verificado)
    VALUES($1,'Single message sintetico',$2,$3,'RESTAURANTE','aprobado',true,true)`,
  [owner,email,await bcrypt.hash(password,4)]);
  const login = await call('/api/auth/login', { email, password });
  assert.equal(login.status, 200); const token = login.body.access_token; const id = randomUUID();
  const unverifiedId = randomUUID();
  await pool.query(`INSERT INTO platillos (id,restaurante_id,nombre,precio,activo,ingredientes_principales,nivel_picante)
    VALUES ($1,$2,'Pan y pollo sintetico',50,true,'["pollo","chile"]',2)`, [id, owner]);
  await pool.query(`INSERT INTO platillos (id,restaurante_id,nombre,precio,activo,ingredientes_principales,nivel_picante)
    VALUES ($1,$2,'Pollo picoso sin evidencia sintetico',35,true,'["pollo","chile"]',2)`, [unverifiedId, owner]);
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
    const unverified = unrestricted.body.recommendations.find(r => r.dish.id === unverifiedId);
    assert.ok(unverified, `unverified fixture should appear in ${path}`);
    assert.equal(unverified.safety.priceVerified, false);
  }
});
test.after(() => pool.end());
