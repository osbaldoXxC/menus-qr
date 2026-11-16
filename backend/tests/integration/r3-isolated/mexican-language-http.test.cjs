'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const pool = new Pool({ connectionString:process.env.DATABASE_URL });
const owner = 'fb000000-0000-4000-8000-000000000001';
const reviewedOwner = '10000000-0000-4000-8000-000000000001';
const activePort = 4039;
async function post(url, data) {
  const r = await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal(r.status,200); return r.json();
}
const req = text => ({craving:{text,tags:[]},restrictions:{},options:{limit:5,locale:'es-MX'}});
const search = (port,id,text) => post(`http://127.0.0.1:${port}/api/public/menu/${id}/recommendations`,req(text));
const interpret = text => post('http://ml:8013/interpret',{requestId:'spanish-real',...req(text)});
test('real isolated stack: versioned Mexican Spanish, safety and same catalog comparison', async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db,'r3_test_isolated');
  assert.equal((await pool.query('SELECT count(*)::int n FROM platillos WHERE restaurante_id=$1',[owner])).rows[0].n,7);
  const ml = await interpret('Quiero unos camaronsitos');
  assert.equal(ml.meta.linguistic.version,'1.0.0-draft');
  assert.ok(ml.meta.linguistic.mentions.some(m=>m.concept==='camaron' && m.relation==='typo_contextual'));
  const oldChicken = await search(4029,owner,'Quiero un pollito');
  const newChicken = await search(activePort,owner,'Quiero un pollito');
  assert.ok(oldChicken.recommendations.some(x=>x.dish.nombre !== 'Pollo asado'));
  assert.deepEqual(newChicken.recommendations.map(x=>x.dish.nombre),['Pollo asado']);
  const shrimp = await search(activePort,owner,'Quiero unos camaronsitos');
  assert.equal(shrimp.recommendations.length,5);
  assert.ok(shrimp.recommendations.every(x=>x.dish.ingredientes_principales.includes('camarón')));
  const previousBudget = await search(4029,owner,'No más de cien pesos');
  assert.ok(previousBudget.recommendations.some(x=>x.safety.priceVerified === false));
  const noEvidence = await search(activePort,owner,'No más de cien pesos');
  assert.equal(noEvidence.status.code,'no_verified_results');
  const budget = await search(activePort,reviewedOwner,'No más de cien pesos');
  assert.ok(budget.recommendations.length > 0);
  assert.ok(budget.recommendations.every(x=>x.safety.priceVerified && x.dish.precio<=100 && x.safety.restrictions.some(r=>r.type==='budget')));
  const colloquial = await search(activePort,reviewedOwner,'Traigo 80 varos');
  assert.ok(colloquial.recommendations.length > 0);
  assert.ok(colloquial.recommendations.every(x=>x.safety.priceVerified && x.dish.precio<=80));
  const approximate = await interpret('Como unos 100 pesos');
  assert.equal(approximate.extracted.budget.ambiguous,true); assert.equal(approximate.extracted.budget.amount,null);
  const approximateSearch = await search(activePort,owner,'Como unos 100 pesos');
  assert.ok(approximateSearch.recommendations.some(x=>x.safety.priceVerified===false));
  const contradictory = await search(activePort,owner,'Traigo 90 pesos, pero no más de 100 pesos');
  assert.equal(contradictory.status.code,'no_verified_results');
  const unsupportedAmount = await search(activePort,owner,'No más de doscientos pesos');
  assert.equal(unsupportedAmount.status.code,'no_verified_results');
  const permitted = await search(activePort,owner,'No me molesta que pique');
  assert.ok(permitted.recommendations.some(x=>x.dish.nivel_picante===3));
  const mild = await search(activePort,owner,'Que no pique nadita');
  assert.ok(mild.recommendations.length>0); assert.ok(mild.recommendations.every(x=>x.dish.nivel_picante===0));
  const shrimpMild = await search(activePort,owner,'Quiero camarones pero sin picante');
  assert.ok(shrimpMild.recommendations.length>0);
  assert.ok(shrimpMild.recommendations.every(x=>x.dish.nivel_picante===0 && x.dish.ingredientes_principales.includes('camarón')));
  for (const text of ['Quiero algo sin leche','Quiero algo sin camaronsitos','No como carne, pero sí pescado']) {
    const result = await search(activePort,owner,text);
    assert.equal(result.status.code,'no_verified_results',text); assert.deepEqual(result.recommendations,[]);
  }
  const globalMilk = await post(`http://127.0.0.1:${activePort}/api/public/menu/recommendations`,req('Quiero algo sin leche'));
  assert.ok(globalMilk.recommendations.every(x=>!x.dish.ingredientes_principales.includes('leche')));
  console.log(JSON.stringify({version:ml.meta.linguistic.version, beforePollito:oldChicken.recommendations.map(x=>x.dish.nombre),
    afterPollito:newChicken.recommendations.map(x=>x.dish.nombre), shrimp:shrimp.recommendations.length,
    beforeBudget:previousBudget.recommendations.length, unverifiedBudget:noEvidence.status.code, verifiedBudget:budget.recommendations.length,
    approximate:approximate.extracted.budget.ambiguous, noSpice:mild.recommendations.length}));
});
test.after(()=>pool.end());
