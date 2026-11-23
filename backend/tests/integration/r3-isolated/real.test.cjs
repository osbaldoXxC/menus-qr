'use strict';
// Runs only inside the named isolated Compose backend with synthetic data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const root = process.env.R3_REAL_BACKEND_URL || 'http://127.0.0.1:4000';
const owner = randomUUID();
const other = randomUUID();
const dish = randomUUID();
const otherDish = randomUUID();
const missing = randomUUID();
const expensive = randomUUID();
const admin = randomUUID();
let ownerToken, otherToken, adminToken, currencyId, absenceId;
const paths = ['/api/public/menu/recommendations', `/api/public/menu/${owner}/recommendations`];

async function request(path, body, token, method = 'POST', host = root) {
  const response = await fetch(host + path, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
async function inspect(id = dish, token = ownerToken) { return request(`/api/menu/platillos/${id}/evidence`, undefined, token, 'GET'); }
async function login(email) {
  const result = await request('/api/auth/login', { email, password: 'Synthetic-only-123!' });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.ok(result.data.access_token); return result.data.access_token;
}
async function confirmPrice(snapshot, id = dish, token = ownerToken) {
  return request('/api/menu/evidence/currency', { currency: 'MXN', source: 'R3 fixture review',
    catalogFingerprint: snapshot.catalogFingerprint, dishes: [{ id, price: String(snapshot.dish.precio),
      priceRevision: snapshot.dish.evidencia_precio_revision }] }, token);
}
function ids(data) { return data.recommendations.map(r => r.dish.id); }

test('R3 isolated PostgreSQL + authenticated HTTP + real ML V2', async t => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db, 'r3_test_isolated');
  const password = 'Synthetic-only-123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const createOwner = (id, name, email) => pool.query(`INSERT INTO restaurantes
    (id,nombre_negocio,email,password_hash,rol,suscripcion_activa,estado,email_verificado)
    VALUES ($1,$2,$3,$4,'RESTAURANTE',true,'aprobado',true)`, [id,name,email,passwordHash]);
  const ownerEmail = `real-owner-${owner}@example.invalid`;
  const otherEmail = `real-owner-${other}@example.invalid`;
  const adminEmail = `real-admin-${admin}@example.invalid`;
  await createOwner(owner, 'Owner R3 sintetico', ownerEmail);
  await createOwner(other, 'Other R3 sintetico', otherEmail);
  await pool.query(`INSERT INTO restaurantes
    (id,nombre_negocio,email,password_hash,rol,suscripcion_activa,estado,email_verificado)
    VALUES ($1,'Admin sintetico',$2,$3,'SUPER_ADMIN',true,'aprobado',true)`, [admin,adminEmail,passwordHash]);
  await pool.query(`INSERT INTO platillos
    (id,restaurante_id,nombre,descripcion,precio,activo,ingredientes_principales,nivel_picante)
    VALUES ($1,$2,'Taco de pollo picoso sintetico','solo prueba',50,true,'["pollo","chile"]',2),
      ($3,$4,'Platillo de otro owner','solo prueba',50,true,'["pollo"]',0),
      ($5,$2,'Taco caro sintetico','solo prueba',150,true,'["pollo","chile"]',2)`,
  [dish,owner,otherDish,other,expensive]);
  await t.test('historical data starts unverified; real auth sessions', async () => {
    const evidence = await pool.query(`SELECT
      (SELECT count(*)::int FROM confirmacion_moneda_restaurante WHERE restaurante_id=$1) prices,
      (SELECT count(*)::int FROM platillo_ausencia_confirmada WHERE restaurante_id=$1) absences`, [owner]);
    assert.deepEqual(evidence.rows[0], { prices: 0, absences: 0 });
    ownerToken = await login(ownerEmail); otherToken = await login(otherEmail); adminToken = await login(adminEmail);
  });
  await t.test('scope, unauthenticated, other tenant and admin rejected', async () => {
    assert.equal((await inspect(dish, '')).status, 401);
    assert.equal((await inspect(otherDish)).status, 404);
    assert.equal((await inspect(dish, otherToken)).status, 404);
    assert.equal((await inspect(dish, adminToken)).status, 403);
    assert.equal((await request(`/api/menu/platillos/${dish}/verify-approve`, { verification_metadata: {} }, adminToken)).status, 403);
    const snap = await inspect(); assert.equal(snap.status, 200); assert.equal(snap.data.currencyState, 'unknown');
    assert.equal((await confirmPrice(snap.data, otherDish)).status, 404);
    assert.equal((await request('/api/menu/evidence/currency', { verified: true }, ownerToken)).status, 400);
  });
  await t.test('no budget works without currency; budget starts closed', async () => {
    for (const path of paths) {
      const plain = await request(path, { craving: { text: 'Quiero algo picoso' } });
      assert.equal(plain.status, 200); assert.ok(ids(plain.data).includes(dish), JSON.stringify(plain.data));
      const restricted = await request(path, { restrictions: { budgetMax: 100 } });
      assert.equal(restricted.data.status.code, 'no_verified_results');
    }
  });
  await t.test('owner confirms exact price and structured budget is enforced', async () => {
    const snap = await inspect(); const confirmed = await confirmPrice(snap.data); assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
    currencyId = confirmed.data.id;
    const costly = await inspect(expensive); assert.equal((await confirmPrice(costly.data, expensive)).status, 200);
    for (const [index, path] of paths.entries()) {
      const requestId = `r3-budget-real-${index}`;
      const response = await request(path, { restrictions: { budgetMax: 100 }, options: { requestId } });
      assert.equal(response.status, 200); assert.ok(ids(response.data).includes(dish), JSON.stringify(response.data));
      assert.ok(!ids(response.data).includes(expensive)); assert.ok(!ids(response.data).includes(missing));
      assert.equal(response.data.meta.mlUsed, true);
      assert.ok(response.data.recommendations.find(r => r.dish.id === dish).restaurant.menuUrl);
      const captured = await (await fetch(`http://ml-proxy:8010/captured?requestId=${requestId}`)).json();
      assert.equal(captured.length, 1); assert.deepEqual(captured[0].ids, [dish]);
    }
    const fallback = await request(`/api/public/menu/${owner}/recommendations`, { restrictions: { budgetMax: 100 } }, undefined, 'POST', 'http://backend-fallback:4000');
    assert.equal(fallback.data.meta.fallback, true); assert.ok(ids(fallback.data).includes(dish));
    assert.ok(!ids(fallback.data).includes(expensive)); assert.ok(!ids(fallback.data).includes(missing));
  });
  await t.test('textual maximum 100 pesos enforced on both endpoints', async () => {
    for (const path of paths) {
      const response = await request(path, { craving: { text: 'Quiero tacos de máximo 100 pesos' } });
      assert.equal(response.status, 200); assert.ok(ids(response.data).includes(dish), JSON.stringify(response.data));
      assert.ok(!ids(response.data).includes(expensive), JSON.stringify(response.data));
    }
  });
  await t.test('reviewed recipe absence, specific scope and no unsupported allergens', async () => {
    const snap = await inspect(); const tax = snap.data.evidence.taxonomy.find(x => x.grupo === 'cerdo'); assert.ok(tax);
    const keys = ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos','sustituciones_permitidas','modificadores_opcionales'];
    const input = { source: 'Synthetic recipe review', recipeVersion: snap.data.recipeVersion,
      recipeRevision: snap.data.dish.evidencia_receta_revision, group: 'cerdo', taxonomyVersion: tax.version,
      taxonomyRevision: tax.revision, sections: Object.fromEntries(keys.map(k => [k, 'complete'])) };
    const result = await request(`/api/menu/platillos/${dish}/evidence/absence`, input, ownerToken);
    assert.equal(result.status, 200, JSON.stringify(result.data)); absenceId = result.data.id;
    for (const [index, path] of paths.entries()) {
      const requestId = `r3-absence-real-${index}`;
      const r = await request(path, { craving: { text: 'Quiero algo picoso, pero sin puerco' }, options: { requestId } });
      assert.equal(r.status, 200); assert.ok(ids(r.data).includes(dish), JSON.stringify(r.data));
      assert.ok(!ids(r.data).includes(missing)); assert.equal(r.data.meta.mlUsed, true);
      const captured = await (await fetch(`http://ml-proxy:8010/captured?requestId=${requestId}`)).json();
      assert.equal(captured.length, 1); assert.deepEqual(captured[0].ids, [dish]);
    }
  });
  await t.test('price change invalidates, stale confirmation rejected, reconfirm and revoke', async () => {
    const old = await inspect();
    await pool.query('UPDATE platillos SET precio=45 WHERE id=$1', [dish]);
    assert.equal((await confirmPrice(old.data)).status, 409);
    const current = await inspect(); assert.equal(current.data.currencyState, 'unknown');
    const confirmed = await confirmPrice(current.data); assert.equal(confirmed.status, 200); currencyId = confirmed.data.id;
    for (const path of paths) assert.ok(ids((await request(path, { restrictions: { budgetMax: 100 } })).data).includes(dish));
    assert.equal((await request(`/api/menu/evidence/currency/${currencyId}/revoke`, { reason: 'Synthetic test' }, otherToken)).status, 404);
    assert.equal((await request(`/api/menu/evidence/currency/${currencyId}/revoke`, { reason: 'Synthetic test' }, ownerToken)).status, 200);
    for (const path of paths) assert.ok(!ids((await request(path, { restrictions: { budgetMax: 100 } })).data).includes(dish));
  });
  await t.test('recipe change, revoked absence and fallback stay closed', async () => {
    assert.equal((await request(`/api/menu/evidence/absence/${absenceId}/revoke`, { reason: 'Synthetic test' }, ownerToken)).status, 200);
    for (const path of paths) {
      const r = await request(path, { craving: { text: 'Quiero algo picoso, pero sin puerco' } });
      assert.ok(!ids(r.data).includes(dish));
    }
    const fallback = await request(`/api/public/menu/${owner}/recommendations`, { restrictions: { excludedIngredients: ['puerco'] } }, undefined, 'POST', 'http://backend-fallback:4000');
    assert.equal(fallback.data.status.code, 'no_verified_results');
    const snap = await inspect();
    await pool.query("UPDATE platillos SET ingredientes_principales='[\"pollo\",\"cerdo\"]' WHERE id=$1", [dish]);
    assert.notEqual((await inspect()).data.dish.evidencia_receta_revision, snap.data.dish.evidencia_receta_revision);
  });
  await t.test('two PostgreSQL connections serialize concurrent price changes', async () => {
    const a = await pool.connect(), b = await pool.connect();
    try {
      await a.query('BEGIN'); await b.query('BEGIN'); await b.query("SET LOCAL lock_timeout='250ms'");
      await a.query('SELECT id FROM platillos WHERE id=$1 FOR UPDATE', [dish]);
      await assert.rejects(b.query('UPDATE platillos SET precio=42 WHERE id=$1', [dish]), { code: '55P03' });
      await b.query('ROLLBACK'); await a.query('ROLLBACK');
    } finally { a.release(); b.release(); }
  });
  await t.test('audit retained and delete policy is restrictive', async () => {
    const audit = await pool.query('SELECT accion FROM catalogo_evidencia_auditoria WHERE restaurante_id=$1', [owner]);
    assert.ok(audit.rows.some(x => x.accion === 'confirm_currency'));
    assert.ok(audit.rows.some(x => x.accion === 'revoke_absence'));
    await assert.rejects(pool.query('DELETE FROM platillos WHERE id=$1', [dish]), { code: '23503' });
    await pool.query('UPDATE platillos SET activo=false WHERE id=$1', [dish]);
    for (const path of paths) assert.ok(!ids((await request(path, {})).data).includes(dish));
  });
});
test.after(async () => pool.end());
