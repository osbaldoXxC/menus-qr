'use strict';
// Synthetic database and authenticated synthetic owner only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const root = 'http://127.0.0.1:4039';

async function request(path, body, token, method = 'POST') {
  const response = await fetch(root + path, { method, headers: {
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}

test('real ML and PostgreSQL: declared price, evidence and budget boundaries', async () => {
  const identity = await pool.query("SELECT current_database() db, count(*) FILTER (WHERE email NOT LIKE '%@example.invalid')::int unexpected FROM restaurantes");
  assert.equal(identity.rows[0].db, 'r3_test_isolated');
  assert.equal(identity.rows[0].unexpected, 0);
  const owner = randomUUID();
  const email = `budget-${owner}@example.invalid`;
  const password = 'Synthetic-only-123!';
  await pool.query("INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,estado,suscripcion_activa,email_verificado) VALUES($1,'Presupuesto sintetico',$2,$3,'aprobado',true,true)", [owner, email, await bcrypt.hash(password, 4)]);
  const dishes = [50, 100, 120].map(price => ({ id: randomUUID(), price }));
  for (const dish of dishes) {
    await pool.query("INSERT INTO platillos(id,restaurante_id,nombre,precio,activo,ingredientes_principales) VALUES($1,$2,$3,$4,true,'[\"pollo\"]')", [dish.id, owner, `Pollo sintetico ${dish.price}`, dish.price]);
  }
  const token = (await request('/api/auth/login', { email, password })).access_token;
  const search = text => request(`/api/public/menu/${owner}/recommendations`, { craving: { text, tags: [] }, restrictions: {}, options: { limit: 5, locale: 'es-MX' } });
  const before = await search('Quiero pollo');
  assert.deepEqual(before.recommendations.map(x => x.dish.price).sort((a, b) => a - b), [50, 100, 120]);
  assert.ok(before.recommendations.every(x => x.safety.priceVerified === false));
  assert.equal((await search('No más de cien pesos')).status.code, 'no_verified_results');
  for (const dish of dishes) {
    const snapshot = await request(`/api/menu/platillos/${dish.id}/evidence`, null, token, 'GET');
    await request('/api/menu/evidence/currency', { currency: 'MXN', source: 'Prueba sintetica aislada', catalogFingerprint: snapshot.catalogFingerprint,
      dishes: [{ id: dish.id, price: String(snapshot.dish.precio), priceRevision: snapshot.dish.evidencia_precio_revision }] }, token);
  }
  const limit100 = await search('No más de cien pesos');
  assert.deepEqual(limit100.recommendations.map(x => x.dish.price).sort((a, b) => a - b), [50, 100]);
  assert.ok(limit100.recommendations.every(x => x.safety.priceVerified && x.safety.restrictions.some(r => r.type === 'budget')));
  const limit80 = await search('Traigo 80 varos');
  assert.deepEqual(limit80.recommendations.map(x => x.dish.price), [50]);
  console.log(JSON.stringify({ noBudget: [50, 100, 120], unverifiedBudget: 'no_verified_results', limit100: [50, 100], limit80: [50] }));
});
test.after(() => pool.end());
