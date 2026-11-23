'use strict';
// Only synthetic data and owner in the existing ephemeral PostgreSQL environment.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = randomUUID();
const email = `quality-evidence-${owner}@example.invalid`;
const password = 'Synthetic-only-123!';
async function call(path, body, token, method = 'POST') {
  const r = await fetch('http://127.0.0.1:4013' + path, { method, headers: {
    ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, body: await r.json() };
}
test('isolated R3: authenticated synthetic owner, evidence, budget and revocation', async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db, 'r3_test_isolated');
  await pool.query(`INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,rol,estado,suscripcion_activa,email_verificado)
    VALUES($1,'Quality evidence sintetico',$2,$3,'RESTAURANTE','aprobado',true,true)`,
  [owner,email,await bcrypt.hash(password,4)]);
  const login = await call('/api/auth/login', { email, password });
  assert.equal(login.status, 200); const token = login.body.access_token; const id = randomUUID();
  await pool.query(`INSERT INTO platillos (id,restaurante_id,nombre,precio,activo,ingredientes_principales,nivel_picante)
    VALUES ($1,$2,'Pollo picante evidencia sintetica',50,true,'["pollo","chile"]',3)`, [id, owner]);
  const snapshot = await call(`/api/menu/platillos/${id}/evidence`, null, token, 'GET');
  assert.equal(snapshot.status, 200); const s = snapshot.body;
  const price = await call('/api/menu/evidence/currency', { currency: 'MXN', source: 'Prueba sintetica aislada',
    catalogFingerprint: s.catalogFingerprint, dishes: [{ id, price: s.dish.precio, priceRevision: s.dish.evidencia_precio_revision }] }, token);
  assert.equal(price.status, 200, JSON.stringify(price.body));
  const tax = s.evidence.taxonomy.find(x => x.grupo === 'cerdo'); assert.ok(tax);
  const keys = ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos','sustituciones_permitidas','modificadores_opcionales'];
  const absence = await call(`/api/menu/platillos/${id}/evidence/absence`, { source: 'Receta sintetica revisada',
    recipeVersion: s.recipeVersion, recipeRevision: s.dish.evidencia_receta_revision, group: 'cerdo',
    taxonomyVersion: tax.version, taxonomyRevision: tax.revision, sections: Object.fromEntries(keys.map(k => [k, 'complete'])) }, token);
  assert.equal(absence.status, 200, JSON.stringify(absence.body));
  for (const path of ['/api/public/menu/recommendations', `/api/public/menu/${owner}/recommendations`]) {
    const response = await call(path, { craving: { text: 'Quiero algo picoso sin puerco, y tengo 100 pesos' }, options: { limit: 10 } });
    assert.equal(response.status, 200);
    const item = response.body.recommendations.find(x => x.dish.id === id);
    assert.ok(item, JSON.stringify(response.body));
    assert.equal(item.safety.priceVerified, true);
    assert.ok(item.safety.restrictions.some(x => x.type === 'budget'));
    assert.ok(item.safety.restrictions.some(x => x.type === 'exclusion'));
    assert.ok(response.body.recommendations.every(x => x.dish.precio <= 100));
  }
  const revoked = await call(`/api/menu/evidence/absence/${absence.body.id}/revoke`, { reason: 'Revocacion de prueba sintetica' }, token);
  assert.equal(revoked.status, 200);
  const after = await call(`/api/public/menu/${owner}/recommendations`, { craving: { text: 'Quiero algo picoso sin puerco, y tengo 100 pesos' }, options: { limit: 10 } });
  assert.equal(after.status, 200);
  assert.ok(!after.body.recommendations.some(x => x.dish.id === id));
});
test.after(() => pool.end());
