'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = 'fa000000-0000-4000-8000-000000000001';
async function post(url, body) {
  const r = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) });
  assert.equal(r.status, 200); return r.json();
}
const request = text => ({ craving:{text,tags:[]}, restrictions:{}, options:{limit:5,locale:'es-MX'} });
test('real DB + real ML V2 + backend: three cases on unchanged catalog', async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db, 'r3_test_isolated');
  const rows = (await pool.query('SELECT id,nombre,ingredientes_principales,nivel_picante FROM platillos WHERE restaurante_id=$1 ORDER BY nombre',[owner])).rows;
  assert.equal(rows.length,4);
  const text = 'Quiero algo que no lleve leche';
  const interpretation = await post('http://ml:8005/interpret', { requestId:'milk-real', ...request(text) });
  assert.ok(interpretation.extracted.excludedIngredients.includes('leche'));
  const base = `http://127.0.0.1:4020/api/public/menu/${owner}/recommendations`;
  const milk = await post(base,request(text));
  assert.equal(milk.status.code,'no_verified_results'); assert.deepEqual(milk.recommendations,[]);
  const shrimp = await post(base,request('Quiero camarones'));
  assert.equal(shrimp.meta.mlUsed,true); assert.equal(shrimp.recommendations[0].dish.nombre,'Camarones al limón');
  const chicken = shrimp.recommendations.find(x => x.dish.nombre === 'Pollo asado'); assert.ok(chicken);
  assert.ok(chicken.match.score < shrimp.recommendations[0].match.score);
  const noHeat = await post(base,request('Quiero algo que no pique'));
  assert.ok(noHeat.recommendations.length > 0);
  assert.ok(noHeat.recommendations.every(x => x.dish.nivel_picante === 0));
  const omitted = await post('http://127.0.0.1:8015/interpret', { requestId:'milk-omitted', ...request(text) });
  assert.deepEqual(omitted.extracted.excludedIngredients, []);
  assert.deepEqual(omitted.extracted.negations, []);
  const unknown = await post(`http://127.0.0.1:4021/api/public/menu/${owner}/recommendations`,request(text));
  assert.equal(unknown.status.code,'no_verified_results'); assert.deepEqual(unknown.recommendations,[]);
  const fallback = await post(`http://127.0.0.1:4022/api/public/menu/${owner}/recommendations`,request(text));
  assert.equal(fallback.status.code,'no_verified_results'); assert.deepEqual(fallback.recommendations,[]);
  console.log(JSON.stringify({ candidates:rows.length, interpretation:interpretation.extracted.excludedIngredients,
    milk:milk.status.code, shrimp:shrimp.recommendations.map(x => [x.dish.nombre,x.match.score]),
    noHeat:noHeat.recommendations.map(x => [x.dish.nombre,x.dish.nivel_picante]), omittedML:unknown.status.code, mlDown:fallback.status.code }));
});
test.after(() => pool.end());
