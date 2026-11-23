'use strict';
// Exercises the unversioned schema and a concurrent price change in tmpfs only.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const connectionString = process.env.R3_ROLLBACK_DATABASE_URL || (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('/r3_test_isolated', '/r3_test_rollback') : undefined);
const pool = new Pool({ connectionString });

test('unversioned local catalogue rechecks the current price before responding', async () => {
  const identity = await pool.query("SELECT current_database() db, count(*) FILTER (WHERE email NOT LIKE '%@example.invalid')::int unexpected FROM restaurantes");
  assert.equal(identity.rows[0].db, 'r3_test_rollback'); assert.equal(identity.rows[0].unexpected, 0);
  const schema = await pool.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='platillos' AND column_name='evidencia_precio_revision'");
  assert.equal(schema.rows[0].n, 0);
  const owner = randomUUID(); const cheap = randomUUID(); const expensive = randomUUID();
  await pool.query("INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,estado,suscripcion_activa) VALUES($1,'Agua temporal',$2,'!disabled','aprobado',true)", [owner, `water-${owner}@example.invalid`]);
  await pool.query("INSERT INTO platillos(id,restaurante_id,nombre,precio,activo,ingredientes_principales) VALUES($1,$3,'Agua fresca de limón',35,true,'[\"agua\",\"limón\"]'),($2,$3,'Agua fresca de limón',41,true,'[\"agua\",\"limón\"]')", [cheap, expensive, owner]);
  let changeDuringRank = false;
  const proxy = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      if (req.url === '/rank' && changeDuringRank) {
        changeDuringRank = false;
        await pool.query('UPDATE platillos SET precio=41 WHERE id=$1', [cheap]);
      }
      const upstream = await fetch(`http://ml:8000${req.url}`, { method: req.method, headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks) });
      res.writeHead(upstream.status, { 'content-type': 'application/json' }); res.end(await upstream.text());
    } catch (error) { res.writeHead(502); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => proxy.listen(8019, '127.0.0.1', resolve));
  try {
    const query = async () => {
      const response = await fetch(`http://127.0.0.1:4044/api/public/menu/${owner}/recommendations`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ craving: { text: 'quiero una agua fresca de limon pero solo tengo 40 pesos', tags: [] }, restrictions: {}, options: { limit: 5, locale: 'es-MX' } }) });
      assert.equal(response.status, 200); return response.json();
    };
    const initial = await query();
    assert.deepEqual(initial.recommendations.map(r => r.dish.price), [35]);
    assert.equal(initial.recommendations[0].safety.priceVerified, false);
    changeDuringRank = true;
    const changed = await query();
    assert.equal(changeDuringRank, false, 'ML rank was not reached');
    assert.equal(changed.status.code, 'no_verified_results');
    assert.deepEqual(changed.recommendations, []);
    console.log(JSON.stringify({ initial: [35], priceChangedDuringRank: 41, returnedAfterChange: 0 }));
  } finally { await new Promise(resolve => proxy.close(resolve)); }
});
test.after(() => pool.end());
