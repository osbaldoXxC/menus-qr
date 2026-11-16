'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = process.env.RELEVANCE_OWNER || 'fb000000-0000-4000-8000-000000000001';
const port = process.env.RELEVANCE_PORT || '4029';
const stage = process.env.RELEVANCE_STAGE || 'without';
async function query(text, host = port, restrictions = {}) {
  const r = await fetch(`http://127.0.0.1:${host}/api/public/menu/${owner}/recommendations`, { method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({craving:{text,tags:[]},restrictions,options:{limit:5,locale:'es-MX'}}) });
  assert.equal(r.status,200); return r.json();
}
test(`real DB and ML: relevance ${stage}`, async () => {
  assert.equal((await pool.query('SELECT current_database() db')).rows[0].db,'r3_test_isolated');
  const n = (await pool.query('SELECT count(*)::int n FROM platillos WHERE restaurante_id=$1',[owner])).rows[0].n;
  assert.equal(n,stage === 'with' ? 7 : 2);
  const shrimp = await query('Quiero camarones');
  if (stage === 'before') {
    assert.ok(shrimp.recommendations.some(x=>x.dish.nombre === 'Pizza de champiñones'));
  } else if (stage === 'without') {
    assert.equal(shrimp.status.code,'no_verified_results');
    assert.equal(shrimp.meta.mlReason,'no_relevant_candidates'); assert.deepEqual(shrimp.recommendations,[]);
  } else {
    assert.equal(shrimp.meta.mlUsed,true); assert.equal(shrimp.recommendations.length,5);
    assert.ok(shrimp.recommendations.every(x=>x.dish.ingredientes_principales.includes('camarón')));
    assert.ok(shrimp.recommendations.every(x=>x.dish.url_imagen && x.dish.descripcion.includes('creativecommons.org')));
    for (const text of ['Quiero algo con camarones', 'Quiero quisquillas']) {
      const variation = await query(text);
      assert.equal(variation.recommendations.length,5);
      assert.ok(variation.recommendations.every(x=>x.dish.ingredientes_principales.includes('camarón')));
    }
    const allergy = await query('Quiero camarones',port,{allergies:['camaron']});
    assert.equal(allergy.status.code,'no_verified_results'); assert.deepEqual(allergy.recommendations,[]);
    const safe = await query('Quiero camarones que no pique');
    assert.ok(safe.recommendations.length > 0);
    assert.ok(safe.recommendations.every(x=>x.dish.nivel_picante===0 && x.dish.ingredientes_principales.includes('camarón')));
    assert.ok(!safe.recommendations.some(x=>x.dish.nombre==='Camarones a la diabla'));
  }
  if (stage !== 'before') {
    const chicken = await query('Quiero pollo');
    assert.deepEqual(chicken.recommendations.map(x=>x.dish.nombre),['Pollo asado']);
    const unavailable = await query('Quiero camarones','4030');
    assert.equal(unavailable.status.code,'no_verified_results'); assert.deepEqual(unavailable.recommendations,[]);
    const rankUnavailable = await query('Quiero camarones','4031');
    if (stage === 'without') {
      assert.equal(rankUnavailable.status.code,'no_verified_results'); assert.deepEqual(rankUnavailable.recommendations,[]);
    } else {
      assert.equal(rankUnavailable.meta.fallback,true);
      assert.equal(rankUnavailable.recommendations.length,5);
      assert.ok(rankUnavailable.recommendations.every(x=>x.dish.ingredientes_principales.includes('camarón')));
    }
  }
  console.log(JSON.stringify({stage,candidates:n,shrimpStatus:shrimp.status.code,reason:shrimp.meta.mlReason,
    results:shrimp.recommendations.map(x=>x.dish.nombre)}));
});
test.after(()=>pool.end());
