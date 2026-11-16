'use strict';
// Only the synthetic tmpfs database and temporary backend processes are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function search(port, path, text) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ craving: { text, tags: [] }, restrictions: {}, options: { limit: 10, locale: 'es-MX' } }) });
  assert.equal(response.status, 200);
  return response.json();
}

test('local MXN override: real HTTP and ML respect 40 pesos without certifying prices', async () => {
  const identity = await pool.query("SELECT current_database() db, count(*) FILTER (WHERE email NOT LIKE '%@example.invalid')::int unexpected FROM restaurantes");
  assert.equal(identity.rows[0].db, 'r3_test_isolated'); assert.equal(identity.rows[0].unexpected, 0);
  const owner = randomUUID();
  await pool.query("INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,estado,suscripcion_activa) VALUES($1,'Agua sintetica',$2,'!disabled','aprobado',true)", [owner, `water-${owner}@example.invalid`]);
  const dishes = [35, 40, 41].map(price => ({ id: randomUUID(), price }));
  for (const dish of dishes) await pool.query("INSERT INTO platillos(id,restaurante_id,nombre,precio,activo,ingredientes_principales) VALUES($1,$2,'Agua fresca de limón',$3,true,'[\"agua\",\"limón\"]')", [dish.id, owner, dish.price]);
  const path = `/api/public/menu/${owner}/recommendations`;
  const phrase = 'quiero una agua fresca de limon pero solo tengo 40 pesos';
  assert.equal((await search(4039, path, phrase)).status.code, 'no_verified_results');
  const local = await search(4041, path, phrase);
  assert.deepEqual(local.recommendations.map(r => r.dish.price).sort((a, b) => a - b), [35, 40]);
  assert.ok(local.recommendations.every(r => r.safety.priceVerified === false && r.safety.restrictions.some(x => x.type === 'budget')));
  const global = await search(4041, '/api/public/menu/recommendations', phrase);
  assert.ok(global.recommendations.some(r => dishes.slice(0, 2).some(d => d.id === r.dish.id)));
  assert.ok(global.recommendations.every(r => r.dish.price <= 40));
  const excluded = await search(4041, path, 'quiero agua fresca de limón sin leche y tengo 40 pesos');
  assert.equal(excluded.status.code, 'no_verified_results');
  assert.equal((await pool.query('SELECT count(*)::int n FROM confirmacion_moneda_restaurante WHERE restaurante_id=$1', [owner])).rows[0].n, 0);
  console.log(JSON.stringify({ strict: 'no_verified_results', localPrices: [35, 40], overBudgetExcluded: 41, milk: excluded.status.code, confirmations: 0 }));
});
test.after(() => pool.end());
