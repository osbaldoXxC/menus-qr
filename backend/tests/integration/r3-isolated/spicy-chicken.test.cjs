'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { consolidateRestrictions } = require('/app/src/services/restrictionConsolidation');
const { evaluateEligibility } = require('/app/src/services/eligibilityService');
const { sanitizeMlExtractionForConsolidation } = require('/app/src/controllers/menuController');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function post(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200); return response.json();
}
test('real PostgreSQL → interpret → eligibility → rank → HTTP: spicy chicken', async () => {
  assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db, 'r3_test_isolated');
  const owner = randomUUID(), hot = randomUUID(), mild = randomUUID();
  const email = `spice-${owner}@example.invalid`;
  await pool.query("INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,estado,suscripcion_activa) VALUES($1,'Control sintético',$2,'!disabled','aprobado',true)", [owner,email]);
  for (const [id, level] of [[hot,4], [mild,0]]) {
    await pool.query("INSERT INTO platillos(id,restaurante_id,nombre,descripcion,precio,activo,ingredientes_principales,nivel_picante) VALUES($1,$2,'Pollo asado','Pollo asado',90,true,'[\"pollo\"]',$3)", [id,owner,level]);
  }
  const requestId = `spice-${owner}`, craving = { text: 'Quiero pollo que pique bastante', tags: [] }, restrictions = {}, options = { limit: 5, locale: 'es-MX', requestId };
  const interpreted = await post('http://ml:8004/interpret', { requestId, craving, restrictions, options });
  assert.ok(interpreted.extracted.preferences.includes('pique'));
  const rows = (await pool.query('SELECT * FROM platillos WHERE restaurante_id=$1 AND activo=true ORDER BY nombre ASC', [owner])).rows;
  assert.equal(rows.length, 2);
  const extraction = sanitizeMlExtractionForConsolidation(interpreted.extracted, restrictions, craving.text);
  const consolidation = consolidateRestrictions({ requestId, structuredRestrictions: restrictions, mlExtraction: extraction });
  const eligible = evaluateEligibility(rows, consolidation);
  assert.equal(eligible.eligibleCount, 2);
  const candidates = eligible.eligible.map(d => ({ id: d.id, nombre: d.nombre, descripcion: d.descripcion, categoria_nombre: '', precio: Number(d.precio), ingredientes_principales: d.ingredientes_principales, complementos: d.complementos, etiquetas_dieteticas: d.etiquetas_dieteticas, nivel_picante: d.nivel_picante }));
  const ranked = await post('http://ml:8004/rank', { requestId, scope: 'restaurant', craving, restrictions, options, candidates, extracted: interpreted.extracted });
  assert.deepEqual(ranked.ranked.map(x => x.dishId), [hot, mild]);
  const result = await post(`http://127.0.0.1:4014/api/public/menu/${owner}/recommendations`, { craving, restrictions, options });
  assert.equal(result.meta.mlUsed, true); assert.equal(result.meta.fallback, false);
  assert.equal(result.meta.totalCandidates, 2); assert.equal(result.meta.evaluatedCandidates, 2);
  assert.deepEqual(result.recommendations.map(x => x.dish.id), [hot,mild]);
  const [first, second] = result.recommendations;
  assert.equal(first.dish.nivel_picante, 4); assert.equal(second.dish.nivel_picante, 0);
  assert.ok(first.match.score > second.match.score);
  assert.ok(second.match.score <= 0.495);
  assert.match(second.reasons[0].text, /picante 0; coincidencia parcial/);
  console.log(JSON.stringify({ interpreted: interpreted.extracted.preferences, postgresCandidates: rows.length, eligible: eligible.eligibleCount,
    rank: ranked.ranked.map(x => ({ id: x.dishId, score: x.score })), http: result.recommendations.map(x => ({ id: x.dish.id, spice: x.dish.nivel_picante, score: x.match.score, reason: x.reasons[0].text })) }));
});
test.after(async () => {
  await pool.end();
  await require('/app/src/config/db').pool.end();
  const redis = require('/app/src/config/redis');
  if (redis.isOpen) await redis.quit();
});
