'use strict';
// Stub heavy/side-effect modules BEFORE loading controller under test
const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  const r = String(request);
  if (r.endsWith('/config/db') || r === '../config/db' || r.includes('config/db')) {
    return { query: async () => ({ rows: [] }), connect: async () => ({ query: async()=>({rows:[]}), release: ()=>{} }) };
  }
  if (r.endsWith('/config/redis') || r.includes('config/redis')) {
    return { isOpen: false, get: async()=>null, set: async()=>null, del: async()=>null, connect: async()=>{}, on: ()=>{} };
  }
  if (r.includes('/services/subscriptionService') || r.includes('/services/cacheService')) {
    return { SubscriptionService: {}, invalidateMenuCache: async()=>{} };
  }
  if (r.includes('/services/catalogVerification') || r.includes('/services/restrictionConsolidation') || r.includes('/services/eligibilityService') || r.includes('/validators/recommendationRequest') || r.includes('/services/allergenCatalog')) {
    return origLoad.apply(this, arguments);
  }
  return origLoad.apply(this, arguments);
};

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  callMlInterpret,
  recommendWithMlV2,
} = require('../../src/controllers/menuController');
const { consolidateRestrictions } = require('../../src/services/restrictionConsolidation');
const { evaluateEligibility } = require('../../src/services/eligibilityService');

function restoreAxios(original) { axios.post = original; }

function dish(id, name = 'Dish') {
  return {
    id, nombre: name, descripcion: name, precio: 100, url_imagen: '',
    nivel_picante: 0, porcion: '1', categoria_nombre: 'cat',
    etiquetas_dieteticas: [], ingredientes_principales: [], complementos: []
  };
}

const baseCtx = { requestId: 'req1', scope: 'restaurant', craving: {text:'taco'}, restrictions: {}, options: {limit:5}, fallbackContext: {limit:5, restaurantId:'r1', restaurantName:'R', restaurantSlug:'r', menuUrl:'u'} };

test('R2 BE: callMlInterpret maps/discards safely', async (t) => {
  await t.test('valid interpret -> extracted and conservative mlExtraction', async () => {
    const orig = axios.post;
    axios.post = async (url) => {
      if (String(url).endsWith('/interpret')) return { data: { requestId: 'req1', extracted: { allergies: ['mani'], excludedIngredients: ['cebolla'], diet: 'none', ambiguous: false } } };
      throw new Error('unexpected');
    };
    try {
      const res = await callMlInterpret({ requestId: 'req1', craving: { text: 'tacos', tags: [] }, restrictions: { allergies: ['mani'], diet: 'none', excludedIngredients: [] }, options: { limit: 5 } });
      assert.equal(res.ok, true);
      assert.ok(res.extracted && typeof res.extracted === 'object');
      assert.ok(res.mlExtraction && Array.isArray(res.mlExtraction.allergies));
    } finally { restoreAxios(orig); }
  });

  await t.test('malformed interpret (no extracted) -> discarded', async () => {
    const orig = axios.post;
    axios.post = async () => ({ data: { requestId: 'req1' } });
    try {
      const res = await callMlInterpret({ requestId: 'req1', craving: {}, restrictions: {}, options: { limit: 5 } });
      assert.equal(res.ok, false); assert.equal(res.extracted, null); assert.equal(res.mlExtraction, null);
    } finally { restoreAxios(orig); }
  });

  await t.test('interpret timeout/error -> ok false', async () => {
    const orig = axios.post;
    axios.post = async () => { const e = new Error('timeout'); e.code = 'ECONNABORTED'; throw e; };
    try {
      const res = await callMlInterpret({ requestId: 'req1', craving: {}, restrictions: {}, options: { limit: 5 } });
      assert.equal(res.ok, false); assert.equal(res.mlExtraction, null);
    } finally { restoreAxios(orig); }
  });

  await t.test('interpret HTTP 400/422/429/500 -> safe discard', async () => {
    for (const status of [400, 422, 429, 500]) {
      const orig = axios.post;
      axios.post = async () => { const e = new Error('http'); e.response = { status, data: { detail: 'x' } }; throw e; };
      try {
        const res = await callMlInterpret({ requestId: 'req1', craving: {}, restrictions: {}, options: { limit: 5 } });
        assert.equal(res.ok, false, 'status '+status);
        assert.equal(res.mlExtraction, null);
      } finally { restoreAxios(orig); }
    }
  });

  await t.test('interpret invalid JSON shape variants -> discard', async () => {
    const variants = [null, 'nope', 123, [], { extracted: 'bad' }, { extracted: [] }, { requestId: 'req1', extracted: null }];
    for (const data of variants) {
      const orig = axios.post;
      axios.post = async () => ({ data });
      try {
        const res = await callMlInterpret({ requestId: 'req1', craving: {}, restrictions: {}, options: { limit: 5 } });
        assert.equal(res.ok, false);
      } finally { restoreAxios(orig); }
    }
  });

  await t.test('interpret requestId mismatch -> untrusted discard', async () => {
    const orig = axios.post;
    axios.post = async () => ({ data: { requestId: 'other', extracted: { diet: 'none' } } });
    try {
      const res = await callMlInterpret({ requestId: 'req1', craving: {}, restrictions: {}, options: { limit: 5 } });
      assert.equal(res.ok, false);
      assert.equal(res.meta.reason, 'request_id_mismatch');
    } finally { restoreAxios(orig); }
  });
});

test('R2 BE: recommendWithMlV2 rank validation/fallback/resilience', async (t) => {
  const eligible = [dish('d1', 'Taco'), dish('d2', 'Sopa')];

  await t.test('calls /rank and returns only eligible ids', async () => {
    const orig = axios.post; const urls = [];
    axios.post = async (url, payload) => {
      urls.push(String(url));
      if (String(url).endsWith('/rank')) {
        assert.ok(payload.candidates.every(c => ['d1','d2'].includes(String(c.id))));
        return { data: { requestId: 'req1', ranked: [ { dishId: 'd2', score: 0.9, reasons: ['ok'] }, { dishId: 'evil', score: 1 } ], meta: {} } };
      }
      throw new Error('unexpected ' + url);
    };
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
      assert.equal(res.fallback, false);
      assert.deepEqual(res.recommendations.map(r => String(r.dish.id)), ['d2']);
      assert.ok(urls.every(u => !u.includes('/recommendations')));
      assert.ok(urls.some(u => u.endsWith('/rank')));
      assert.ok(!urls.some(u => u.endsWith('/interpret')));
    } finally { restoreAxios(orig); }
  });

  await t.test('rejects malformed scores/reasons/NaN/inf and clamps', async () => {
    const orig = axios.post;
    axios.post = async () => ({ data: { requestId: 'req1', ranked: [
      { dishId: 'd1', score: 'bad', reasons: [1,2,3,4] },
      { dishId: 'd2', score: 999, reasons: 'nope' }
    ] } });
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
      assert.ok(res.recommendations.length >= 1);
      assert.ok(res.recommendations.every(r => typeof r.matchScore === 'number' && Number.isFinite(r.matchScore) && r.matchScore >= 0 && r.matchScore <= 0.99));
      assert.ok(res.recommendations.every(r => Array.isArray(r.reasons)));
    } finally { restoreAxios(orig); }
  });

  await t.test('respects requested limit', async () => {
    const orig = axios.post; const many = [dish('d1'), dish('d2'), dish('d3')];
    axios.post = async () => ({ data: { requestId: 'req1', ranked: [ {dishId:'d1',score:0.9},{dishId:'d2',score:0.8},{dishId:'d3',score:0.7} ] } });
    try {
      const res = await recommendWithMlV2({ ...baseCtx, options:{limit:2}, fallbackContext:{...baseCtx.fallbackContext,limit:2}, eligibleDishes: many, extracted: null, interpretOk: false });
      assert.equal(res.recommendations.length, 2);
    } finally { restoreAxios(orig); }
  });

  await t.test('uses backend authoritative dish data', async () => {
    const orig = axios.post;
    axios.post = async () => ({ data: { requestId: 'req1', ranked: [ { dishId: 'd1', score: 0.95, reasons: ['ml'] } ] } });
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: [dish('d1','REAL_NAME')], fallbackContext: {limit:5, restaurantId:'R1', restaurantName:'AUTH', restaurantSlug:'auth', menuUrl:'mu'}, extracted: null, interpretOk: false });
      assert.equal(res.recommendations[0].dish.nombre, 'REAL_NAME');
      assert.equal(res.recommendations[0].restaurant.name, 'AUTH');
    } finally { restoreAxios(orig); }
  });

  await t.test('rank timeout/error -> deterministic fallback on eligible only', async () => {
    const orig = axios.post;
    axios.post = async (url) => { if (String(url).endsWith('/rank')) { const e = new Error('timeout'); e.code='ECONNABORTED'; throw e; } throw new Error('unexpected'); };
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: true });
      assert.equal(res.fallback, true);
      assert.ok(res.recommendations.length >= 1);
      assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
    } finally { restoreAxios(orig); }
  });

  await t.test('rank HTTP 400/422/429/500 -> fallback eligible only', async () => {
    for (const status of [400,422,429,500]) {
      const orig = axios.post;
      axios.post = async () => { const e = new Error('http'); e.response={status, data:{}}; throw e; };
      try {
        const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
        assert.equal(res.fallback, true, 'status '+status);
        assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
      } finally { restoreAxios(orig); }
    }
  });

  await t.test('rank invalid JSON shape/structure -> fallback', async () => {
    const variants = [{ ranked: 'nope' }, { ranked: null }, 'x', null, [], { requestId:'req1' }];
    for (const data of variants) {
      const orig = axios.post; axios.post = async () => ({ data });
      try {
        const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
        assert.equal(res.fallback, true);
        assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
      } finally { restoreAxios(orig); }
    }
  });

  await t.test('rank requestId mismatch -> fallback (untrusted)', async () => {
    const orig = axios.post;
    axios.post = async () => ({ data: { requestId: 'other', ranked: [ {dishId:'d1',score:0.9} ] } });
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
      assert.equal(res.fallback, true);
      assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
    } finally { restoreAxios(orig); }
  });

  await t.test('rank partial/mixed items (external, dup, malformed, missing id) -> sanitized subset', async () => {
    const orig = axios.post;
    axios.post = async () => ({ data: { requestId: 'req1', ranked: [
      { dishId: 'evil', score: 0.99 },
      { dishId: 'd1', score: 0.8, reasons: ['ok'] },
      { dishId: 'd1', score: 0.7 },
      { score: 0.6 },
      null,
      { dishId: 'd2', score: -5, reasons: ['x','y','z','w'] }
    ] } });
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
      assert.ok(res.recommendations.length >= 1);
      const ids = res.recommendations.map(r => String(r.dish.id));
      assert.ok(ids.every(id => ['d1','d2'].includes(id)));
      assert.equal(new Set(ids).size, ids.length);
    } finally { restoreAxios(orig); }
  });

  await t.test('no eligible candidates -> empty, no rank call', async () => {
    const orig = axios.post; let called = 0; axios.post = async () => { called++; return { data: {} }; };
    try {
      const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: [], extracted: null, interpretOk: false });
      assert.equal(res.recommendations.length, 0);
      assert.equal(called, 0);
    } finally { restoreAxios(orig); }
  });

  await t.test('never calls ML v1 /recommendations', async () => {
    const orig = axios.post; const urls = [];
    axios.post = async (url) => { urls.push(String(url)); return { data: { requestId: 'req1', ranked: [ {dishId:'d1',score:0.8} ] } }; };
    try {
      await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
      assert.ok(urls.length > 0);
      assert.ok(urls.every(u => !u.includes('/recommendations')));
    } finally { restoreAxios(orig); }
  });
});

test('R2 BE: resilience interpret ok but rank fails -> safe fallback eligible', async () => {
  const orig = axios.post; const eligible = [dish('d1','Taco')];
  let phase = 0; const urls=[];
  axios.post = async (url) => {
    urls.push(String(url));
    if (String(url).endsWith('/interpret')) return { data: { requestId:'req1', extracted:{diet:'none', allergies:[], excludedIngredients:[], ambiguous:false} } };
    if (String(url).endsWith('/rank')) { const e=new Error('fail'); e.response={status:500}; throw e; }
    throw new Error('unexpected '+url);
  };
  try {
    const interp = await callMlInterpret({ requestId:'req1', craving:{text:'x'}, restrictions:{}, options:{limit:5} });
    assert.equal(interp.ok, true);
    const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: interp.extracted, interpretOk: interp.ok });
    assert.equal(res.fallback, true);
    assert.deepEqual(res.recommendations.map(r=>String(r.dish.id)), ['d1']);
    assert.ok(urls.every(u => !u.includes('/recommendations')));
  } finally { restoreAxios(orig); }
});

test('R2 BE: interpret fails but flow continues safely to rank/fallback path inputs', async () => {
  const orig = axios.post; const eligible = [dish('d1','Taco')]; const urls=[];
  axios.post = async (url) => {
    urls.push(String(url));
    if (String(url).endsWith('/interpret')) { const e=new Error('timeout'); throw e; }
    if (String(url).endsWith('/rank')) return { data: { requestId:'req1', ranked:[{dishId:'d1',score:0.7}] } };
    throw new Error('unexpected '+url);
  };
  try {
    const interp = await callMlInterpret({ requestId:'req1', craving:{text:'x'}, restrictions:{}, options:{limit:5} });
    assert.equal(interp.ok, false);
    const cons = consolidateRestrictions({ requestId:'req1', structuredRestrictions:{allergies:['mani']}, mlExtraction: interp.mlExtraction });
    assert.ok(cons.consolidatedRestrictions.some(r=>r.category==='allergy'));
    const res = await recommendWithMlV2({ ...baseCtx, restrictions:{allergies:['mani']}, eligibleDishes: eligible, extracted: interp.extracted, interpretOk: interp.ok });
    assert.ok(res.recommendations.every(r=>String(r.dish.id)==='d1'));
    assert.ok(urls.every(u => !u.includes('/recommendations')));
  } finally { restoreAxios(orig); }
});

test('R2 BE: interpret -> consolidation preserves explicit restrictions', async () => {
  const orig = axios.post;
  axios.post = async (url) => {
    if (String(url).endsWith('/interpret')) return { data: { requestId:'reqc', extracted: { allergies: [], diet: 'none', excludedIngredients: [], ambiguous: false } } };
    throw new Error('unexpected');
  };
  try {
    const interp = await callMlInterpret({ requestId:'reqc', craving:{text:'algo'}, restrictions:{ allergies:['mani'], diet:'none', excludedIngredients:[] }, options:{limit:5} });
    const cons = consolidateRestrictions({ requestId:'reqc', structuredRestrictions:{ allergies:['mani'], diet:'none', excludedIngredients:[] }, mlExtraction: interp.mlExtraction });
    const allergy = cons.consolidatedRestrictions.find(r => r.category === 'allergy');
    assert.ok(allergy, 'explicit structured allergy preserved');
    assert.equal(allergy.normalizedValue, 'mani');
  } finally { restoreAxios(orig); }
});

// =========================================================================
// R2 TERCER CORTE - Objetivo C: endurecer la integración backend
// Objetivo D: revisión de resiliencia (pruebas reproducibles)
// =========================================================================

test('R2 C: retries capped at max 1 (no reintentos ilimitados)', async () => {
  const orig = process.env.ML_SERVICE_RETRIES;
  process.env.ML_SERVICE_RETRIES = '5'; // pide 5; la implementación topa a 1
  let calls = 0;
  const origAxios = axios.post;
  axios.post = async () => { calls++; const e = new Error('http'); e.response = { status: 500, data: {} }; throw e; };
  try {
    const res = await callMlInterpret({ requestId:'req_r1', craving:{}, restrictions:{}, options:{limit:5} });
    assert.equal(res.ok, false);
    // 1 intento inicial + 1 reintento máximo = 2 llamadas
    assert.ok(calls <= 2, `reintentos no acotados: ${calls} llamadas`);
    assert.equal(calls, 2);
  } finally {
    restoreAxios(origAxios);
    if (orig === undefined) delete process.env.ML_SERVICE_RETRIES; else process.env.ML_SERVICE_RETRIES = orig;
  }
});

test('R2 C: default retries zero -> intento único', async () => {
  const origRet = process.env.ML_SERVICE_RETRIES;
  delete process.env.ML_SERVICE_RETRIES;
  let calls = 0;
  const origAxios = axios.post;
  axios.post = async () => { calls++; const e = new Error('http'); e.response = { status: 500, data: {} }; throw e; };
  try {
    await callMlInterpret({ requestId:'req_r0', craving:{}, restrictions:{}, options:{limit:5} });
    assert.equal(calls, 1, 'sin reintentos por defecto solo 1 intento');
  } finally {
    restoreAxios(origAxios);
    if (origRet === undefined) delete process.env.ML_SERVICE_RETRIES; else process.env.ML_SERVICE_RETRIES = origRet;
  }
});

test('R2 C: rank con estructura inesperada (ranked no es arreglo) -> fallback', async () => {
  const orig = axios.post;
  axios.post = async (url) => {
    if (String(url).endsWith('/rank')) return { data: { requestId:'req1', ranked: { d1: 0.9 } } };
    throw new Error('unexpected');
  };
  try {
    const eligible = [dish('d1','Taco'), dish('d2','Sopa')];
    const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
    assert.equal(res.fallback, true);
    assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
  } finally { restoreAxios(orig); }
});

test('R2 C: razones truncadas a 240 y máximo 3', async () => {
  const orig = axios.post;
  const longReason = 'x'.repeat(300);
  axios.post = async () => ({ data: { requestId:'req1', ranked: [ { dishId:'d1', score:0.9, reasons:[longReason,'b','c','d','e'] } ] } });
  try {
    const eligible = [dish('d1','Taco')];
    const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, extracted: null, interpretOk: false });
    assert.ok(res.recommendations.length >= 1);
    const reasons = res.recommendations[0].reasons;
    assert.ok(reasons.length <= 3, 'máximo 3 razones');
    assert.ok(reasons.every(r => typeof r === 'string' && r.length <= 240), 'cada razón <= 240 chars');
  } finally { restoreAxios(orig); }
});

test('R2 C: datos finales provienen exclusivamente del backend', async () => {
  const orig = axios.post;
  // ML solo devuelve dishId/score/reasons; el backend hidrata el platillo real
  axios.post = async () => ({ data: { requestId:'req1', ranked: [ { dishId:'d1', score:0.95, reasons:['ml'] } ] } });
  try {
    const eligible = [dish('d1','NOMBRE_REAL_DEL_BACKEND')];
    const res = await recommendWithMlV2({ ...baseCtx, eligibleDishes: eligible, fallbackContext:{limit:5, restaurantId:'R1', restaurantName:'REST_AUTH', restaurantSlug:'auth', menuUrl:'mu'}, extracted: null, interpretOk: false });
    assert.equal(res.recommendations[0].dish.nombre, 'NOMBRE_REAL_DEL_BACKEND');
    assert.equal(res.recommendations[0].restaurant.name, 'REST_AUTH');
    // el score proviene de ML pero acotado por el backend
    assert.ok(Number.isFinite(res.recommendations[0].matchScore));
    assert.ok(res.recommendations[0].matchScore <= 0.99);
  } finally { restoreAxios(orig); }
});

test('R2 C/D: flujo completo interpret->consolidate->eligibility->rank (sin restricciones)', async () => {
  const orig = axios.post;
  axios.post = async (url, payload) => {
    if (String(url).endsWith('/interpret')) return { data: { requestId:'reqfull', extracted: { allergies: [], diet:'none', excludedIngredients: [], ambiguous:false } } };
    if (String(url).endsWith('/rank')) {
      // solo devuelve ids que el backend envió como candidatos
      const ids = (payload.candidates || []).map(c => String(c.id));
      return { data: { requestId:'reqfull', ranked: ids.map((id, i) => ({ dishId: id, score: 0.9 - i*0.1, reasons:['ok'] })) } };
    }
    throw new Error('unexpected '+url);
  };
  try {
    const dishes = [dish('d1','Taco'), dish('d2','Sopa'), dish('d3','Ensalada')];
    const interp = await callMlInterpret({ requestId:'reqfull', craving:{text:'tacos'}, restrictions:{}, options:{limit:5} });
    assert.equal(interp.ok, true);
    const cons = consolidateRestrictions({ requestId:'reqfull', structuredRestrictions:{}, mlExtraction: interp.mlExtraction });
    const elig = evaluateEligibility(dishes, cons, { limit: 5 });
    // sin restricciones -> todos elegibles
    assert.equal(elig.eligibleCount, 3);
    const res = await recommendWithMlV2({ ...baseCtx, requestId:'reqfull', eligibleDishes: elig.eligible, extracted: interp.extracted, interpretOk: interp.ok });
    assert.equal(res.fallback, false);
    assert.equal(res.recommendations.length, 3);
    // los nombres provienen del backend
    const names = res.recommendations.map(r => r.dish.nombre).sort();
    assert.deepEqual(names, ['Ensalada','Sopa','Taco']);
  } finally { restoreAxios(orig); }
});

test('R2 C/D: fail-closed con alergia no verificable -> sin elegibles -> lista vacía', async () => {
  const orig = axios.post;
  axios.post = async (url) => {
    if (String(url).endsWith('/interpret')) return { data: { requestId:'reqfc', extracted: { allergies: ['mani'], diet:'none', excludedIngredients: [], ambiguous:false } } };
    throw new Error('unexpected '+url);
  };
  try {
    // platillos sin metadatos de verificación: la alergia no se puede verificar -> desconocido -> no elegible
    const dishes = [dish('d1','Taco'), dish('d2','Sopa')];
    const interp = await callMlInterpret({ requestId:'reqfc', craving:{text:'x'}, restrictions:{ allergies:['mani'], diet:'none', excludedIngredients:[] }, options:{limit:5} });
    const cons = consolidateRestrictions({ requestId:'reqfc', structuredRestrictions:{ allergies:['mani'], diet:'none', excludedIngredients:[] }, mlExtraction: interp.mlExtraction });
    const elig = evaluateEligibility(dishes, cons, { limit: 5 });
    assert.equal(elig.eligibleCount, 0, 'alergia no verificable -> ningún platillo elegible (fail-closed)');
    const res = await recommendWithMlV2({ ...baseCtx, requestId:'reqfc', eligibleDishes: elig.eligible, extracted: interp.extracted, interpretOk: interp.ok });
    assert.equal(res.recommendations.length, 0);
    assert.equal(res.reason, 'no_eligible_candidates');
  } finally { restoreAxios(orig); }
});

test('R2 D: ML indisponible (interpret+rank fallan) -> fallback solo sobre elegibles', async () => {
  const orig = axios.post;
  axios.post = async () => { const e = new Error('down'); throw e; };
  try {
    const dishes = [dish('d1','Taco'), dish('d2','Sopa')];
    const cons = consolidateRestrictions({ requestId:'reqdown', structuredRestrictions:{}, mlExtraction: null });
    const elig = evaluateEligibility(dishes, cons, { limit: 5 });
    assert.equal(elig.eligibleCount, 2);
    const interp = { ok:false, extracted:null, mlExtraction:null, meta:{interpretOk:false} };
    const res = await recommendWithMlV2({ ...baseCtx, requestId:'reqdown', eligibleDishes: elig.eligible, extracted: interp.extracted, interpretOk: interp.ok });
    assert.equal(res.fallback, true);
    assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
  } finally { restoreAxios(orig); }
});

test('R2 D: interpret ok pero rank falla (timeout) -> fallback seguro sobre elegibles', async () => {
  const orig = axios.post;
  axios.post = async (url) => {
    if (String(url).endsWith('/interpret')) return { data: { requestId:'reqif', extracted: { allergies:[], diet:'none', excludedIngredients:[], ambiguous:false } } };
    if (String(url).endsWith('/rank')) { const e = new Error('timeout'); e.code='ECONNABORTED'; throw e; }
    throw new Error('unexpected '+url);
  };
  try {
    const dishes = [dish('d1','Taco')];
    const interp = await callMlInterpret({ requestId:'reqif', craving:{text:'x'}, restrictions:{}, options:{limit:5} });
    assert.equal(interp.ok, true);
    const cons = consolidateRestrictions({ requestId:'reqif', structuredRestrictions:{}, mlExtraction: interp.mlExtraction });
    const elig = evaluateEligibility(dishes, cons, { limit: 5 });
    const res = await recommendWithMlV2({ ...baseCtx, requestId:'reqif', eligibleDishes: elig.eligible, extracted: interp.extracted, interpretOk: interp.ok });
    assert.equal(res.fallback, true);
    assert.deepEqual(res.recommendations.map(r=>String(r.dish.id)), ['d1']);
  } finally { restoreAxios(orig); }
});

test('R2 D: requestId inconsistente entre endpoints -> rank descartado (no confiable)', async () => {
  const orig = axios.post;
  axios.post = async (url) => {
    if (String(url).endsWith('/interpret')) return { data: { requestId:'reqinc', extracted: { allergies:[], diet:'none', excludedIngredients:[], ambiguous:false } } };
    if (String(url).endsWith('/rank')) return { data: { requestId:'OTHER', ranked:[{dishId:'d1',score:0.9}] } };
    throw new Error('unexpected '+url);
  };
  try {
    const dishes = [dish('d1','Taco')];
    const interp = await callMlInterpret({ requestId:'reqinc', craving:{text:'x'}, restrictions:{}, options:{limit:5} });
    assert.equal(interp.ok, true);
    const cons = consolidateRestrictions({ requestId:'reqinc', structuredRestrictions:{}, mlExtraction: interp.mlExtraction });
    const elig = evaluateEligibility(dishes, cons, { limit: 5 });
    const res = await recommendWithMlV2({ ...baseCtx, requestId:'reqinc', eligibleDishes: elig.eligible, extracted: interp.extracted, interpretOk: interp.ok });
    // requestId de rank no coincide -> tratado como no confiable -> fallback
    assert.equal(res.fallback, true);
    assert.ok(res.recommendations.every(r => ['d1'].includes(String(r.dish.id))));
  } finally { restoreAxios(orig); }
});

test('R2 D: interpret ok rank vacío/malformado -> fallback determinista sobre elegibles', async () => {
  const orig = axios.post;
  axios.post = async (url) => {
    if (String(url).endsWith('/interpret')) return { data: { requestId:'reqem', extracted: { allergies:[], diet:'none', excludedIngredients:[], ambiguous:false } } };
    if (String(url).endsWith('/rank')) return { data: { requestId:'reqem', ranked: [{dishId:'EXTERNAL',score:1}] } };
    throw new Error('unexpected '+url);
  };
  try {
    const dishes = [dish('d1','Taco'), dish('d2','Sopa')];
    const interp = await callMlInterpret({ requestId:'reqem', craving:{text:'x'}, restrictions:{}, options:{limit:5} });
    const cons = consolidateRestrictions({ requestId:'reqem', structuredRestrictions:{}, mlExtraction: interp.mlExtraction });
    const elig = evaluateEligibility(dishes, cons, { limit: 5 });
    const res = await recommendWithMlV2({ ...baseCtx, requestId:'reqem', eligibleDishes: elig.eligible, extracted: interp.extracted, interpretOk: interp.ok });
    // 'EXTERNAL' no es candidato elegible -> descartado -> fallback determinista
    assert.ok(res.recommendations.every(r => ['d1','d2'].includes(String(r.dish.id))));
    assert.ok(!res.recommendations.some(r => String(r.dish.id)==='EXTERNAL'));
  } finally { restoreAxios(orig); }
});
