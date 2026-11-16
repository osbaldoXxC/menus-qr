'use strict';
// DEC-012 (APROBADA 2026-11-12): contrato externo canónico del recomendador V2.
// Stub módulos pesados/side-effect ANTES de cargar el controlador bajo prueba.
const Module = require('module');
const origLoad = Module._load;

// db compartido y mutable: el controlador captura esta referencia al cargar;
// los tests reconfiguran .query para devolver filas según el caso.
const stubDb = {
  query: async () => ({ rows: [] }),
  pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }), end: async () => {} }
};

Module._load = function (request, parent, isMain) {
  const r = String(request);
  if (r.endsWith('/config/db') || r === '../config/db' || r.includes('config/db')) {
    return stubDb;
  }
  if (r.endsWith('/config/redis') || r.includes('config/redis')) {
    return { isOpen: false, get: async () => null, set: async () => null, del: async () => null, connect: async () => {}, on: () => {}, quit: async () => {}, disconnect: () => {} };
  }
  if (r.includes('/services/subscriptionService')) return { default: {}, isActive: () => true };
  if (r.includes('/services/cacheService')) return { invalidateMenuCache: async () => {} };
  if (r.includes('/services/catalogVerification') || r.includes('/services/restrictionConsolidation') || r.includes('/services/eligibilityService') || r.includes('/validators/recommendationRequest') || r.includes('/services/allergenCatalog')) {
    return origLoad.apply(this, arguments);
  }
  return origLoad.apply(this, arguments);
};

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { hasOmittedTextExclusion, hasOmittedTextAllergy, hasUnresolvedTextBudget, filterNoSpice } = require('../../src/controllers/menuController');

test('omitted natural exclusions remain closed, including no lleve and no como', () => {
  for (const text of ['Quiero queso que no lleve puerco', 'No como carne ni pescado']) {
    assert.equal(hasOmittedTextExclusion(text, { excludedIngredients: [] }), true);
  }
  assert.equal(hasOmittedTextExclusion('Sin gastar más de 120 pesos', { excludedIngredients: [] }), false);
  assert.equal(hasOmittedTextExclusion('Sin gastar más de 120 pesos y sin cebolla', { excludedIngredients: [] }), true);
  assert.equal(hasOmittedTextExclusion('No como carne ni pescado', { excludedIngredients: ['carne'] }), true);
  assert.equal(hasOmittedTextExclusion('No como carne ni pescado', { excludedIngredients: [{ value: 'carne' }, { value: 'carne ni' }] }), true);
  assert.equal(hasOmittedTextExclusion('No como carne ni pescado', { excludedIngredients: [{ value: 'carne' }, { value: 'pescado' }] }), false);
});

test('unresolved colloquial monetary budget fails closed rather than being omitted', () => {
  const text = 'sin gastar más de 120 varos';
  assert.equal(hasUnresolvedTextBudget(text, {}, { budget: { ambiguous: false } }, { consolidatedRestrictions: [] }), true);
  assert.equal(hasUnresolvedTextBudget(text, { budgetMax: 100 }, {}, { consolidatedRestrictions: [] }), false);
  assert.equal(hasUnresolvedTextBudget('Traigo 90 pesos, pero no más de 100 pesos', {}, { budget:{ambiguous:true} }, {consolidatedRestrictions:[]}),true);
  assert.equal(hasUnresolvedTextBudget('Como unos 100 pesos', {}, { budget:{ambiguous:true} }, {consolidatedRestrictions:[]}),false);
  assert.equal(hasUnresolvedTextBudget('No más de doscientos pesos', {}, { budget:{ambiguous:true} }, {consolidatedRestrictions:[]}),true);
  assert.equal(hasUnresolvedTextBudget('Tengo ciento veinte pesos', {}, { budget:{ambiguous:true} }, {consolidatedRestrictions:[]}),true);
});

test('explicit exclusions cannot disappear when ML omits them, including lists', () => {
  for (const text of ['Quiero algo que no lleve leche', 'Quiero algo sin leche', 'Quiero algo que no contenga leche', 'No quiero leche', 'Evitar leche', 'Nada de leche', 'No debe contener leche', 'Libre de leche']) {
    assert.equal(hasOmittedTextExclusion(text, null), true);
  }
  assert.equal(hasOmittedTextExclusion('Quiero algo sin queso, crema ni lácteo', { excludedIngredients: [{ value:'queso' }] }), true);
  assert.equal(hasOmittedTextExclusion('Quiero algo sin queso, crema ni lácteo', { excludedIngredients: [{ value:'queso' }, { value:'crema' }, { value:'lácteo' }] }), false);
});

test('no pique only accepts declared zero and leaves other preferences unchanged', () => {
  const dishes = [{ id:'zero',nivel_picante:0 }, { id:'hot',nivel_picante:3 }, { id:'unknown',nivel_picante:null }];
  assert.deepEqual(filterNoSpice(dishes, 'Quiero algo que no pique').map(d => d.id), ['zero']);
  assert.deepEqual(filterNoSpice(dishes, 'Quiero algo que no pique mucho'), dishes);
  assert.deepEqual(filterNoSpice(dishes, 'Quiero algo picoso'), dishes);
  assert.deepEqual(filterNoSpice(dishes, 'No me molesta que pique'), dishes);
  assert.deepEqual(filterNoSpice(dishes, 'Que no pique nadita').map(d => d.id), ['zero']);
  assert.deepEqual(filterNoSpice(dishes, 'Quiero camarones pero sin picante').map(d => d.id), ['zero']);
  assert.equal(hasOmittedTextExclusion('Quiero camarones pero sin picante',null),false);
  assert.equal(hasOmittedTextExclusion('Quiero algo sin picante ni leche',null),true);
});

test('allergies and exclusions are not silently dropped by incomplete ML', () => {
  assert.equal(hasOmittedTextExclusion('Que no traiga leche',null),true);
  assert.equal(hasOmittedTextExclusion('No puedo comer puerco',null),true);
  assert.equal(hasOmittedTextExclusion('No quiero gastar más de 100 varos',null),false);
  assert.equal(hasOmittedTextAllergy('Soy alérgico a leche y cacahuate',{allergies:[{value:'leche'}]}),true);
  assert.equal(hasOmittedTextAllergy('Soy alérgico a leche y cacahuate',{allergies:[{value:'leche'},{value:'cacahuate'}]}),false);
});
const {
  normalizeRecommendationRequest,
  buildValidationErrorResponse,
  buildRecommendationSuccessResponse,
  buildHttpErrorEnvelope
} = require('../../src/validators/recommendationRequest');

// Builder-level (pure) tests ----------------------------------------------------

test('DEC-012 builder: error de validación es envelope uniforme', () => {
  const e = buildValidationErrorResponse([{ field: 'options.limit', reason: 'must_be_between_1_and_10' }], 'req_v', 5);
  assert.deepEqual(Object.keys(e).sort(), ['error', 'meta', 'recommendations', 'requestId', 'safety', 'status'].sort());
  assert.equal(e.requestId, 'req_v');
  assert.equal(e.meta.requestId, 'req_v'); // compat: requestId también en meta
  assert.equal(e.error.code, 'INVALID_REQUEST');
  assert.equal(e.error.retryable, false);
  assert.equal(e.status.code, 'invalid_request');
  assert.deepEqual(e.recommendations, []);
  assert.ok(e.safety && typeof e.safety.disclaimer === 'string');
  assert.equal(e.meta.limitApplied, 5);
});

test('DEC-012 builder: errores HTTP uniformes (404/403/500)', () => {
  const cases = [
    { errorCode: 'NOT_FOUND', statusCode: 'not_found', http: 404 },
    { errorCode: 'RESTAURANT_UNAVAILABLE', statusCode: 'restaurant_unavailable', http: 403 },
    { errorCode: 'INTERNAL_ERROR', statusCode: 'internal_error', http: 500 }
  ];
  for (const c of cases) {
    const e = buildHttpErrorEnvelope({ requestId: 'req_h', errorCode: c.errorCode, statusCode: c.statusCode, message: 'x', scope: { type: 'restaurant', restaurantId: 'r1' }, limitApplied: 5 });
    assert.equal(e.error.code, c.errorCode);
    assert.equal(e.status.code, c.statusCode);
    assert.equal(e.error.retryable, false);
    assert.deepEqual(e.recommendations, []);
    assert.ok(e.safety);
    assert.equal(e.requestId, 'req_h');
  }
});

test('DEC-012 builder: éxito con resultados -> status ok, safety compatible, error null', () => {
  const s = buildRecommendationSuccessResponse({ requestId: 'req_s', recommendations: [{ dish: { id: 'd1' } }], scope: { type: 'restaurant', restaurantId: 'r1' }, totalCandidates: 10, evaluatedCandidates: 10, limitApplied: 5, fallback: false, mlUsed: true, hasUnverifiable: false, extraMeta: { restaurant_id: 'r1' } });
  assert.equal(s.status.code, 'ok');
  assert.equal(s.safety.overall, 'compatible_segun_datos');
  assert.equal(s.safety.hasUnverifiableRestrictions, false);
  assert.equal(s.error, null);
  assert.equal(s.meta.returned, 1);
  assert.equal(s.meta.scope.type, 'restaurant');
  assert.equal(s.meta.restaurant_id, 'r1'); // legacy transitorio conservado
  assert.equal(s.meta.limitApplied, 5);
  assert.equal(s.meta.mlUsed, true);
});

test('DEC-012 builder: sin resultados verificables -> no_verified_results', () => {
  const s = buildRecommendationSuccessResponse({ requestId: 'req_n', recommendations: [], scope: { type: 'global' }, totalCandidates: 5, evaluatedCandidates: 5, limitApplied: 5, fallback: true, mlUsed: false, hasUnverifiable: true });
  assert.equal(s.status.code, 'no_verified_results');
  assert.equal(s.safety.overall, 'sin_resultados_verificables');
  assert.equal(s.safety.hasUnverifiableRestrictions, true);
  assert.deepEqual(s.recommendations, []);
  assert.equal(s.error, null);
});

test('DEC-012 builder: fallback con resultados -> partial_results_sanitized', () => {
  const s = buildRecommendationSuccessResponse({ requestId: 'req_p', recommendations: [{ dish: { id: 'd1' } }], scope: { type: 'restaurant', restaurantId: 'r1' }, totalCandidates: 10, evaluatedCandidates: 10, limitApplied: 5, fallback: true, mlUsed: false, hasUnverifiable: false });
  assert.equal(s.status.code, 'partial_results_sanitized');
  assert.equal(s.safety.overall, 'compatible_segun_datos');
});

// Handler-level (stubbed DB + ML) tests -----------------------------------------
const { getPublicRecommendations, getGlobalRecommendations } = require('../../src/controllers/menuController');

function makeRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
}

function dishRow(id, nombre) {
  return { id, nombre, descripcion: nombre, precio: 100, url_imagen: '', activo: true, ingredientes_principales: [], complementos: [], nivel_picante: 0, porcion: '1', etiquetas_dieteticas: [], categoria_nombre: 'Tacos', restaurante_id: 'r1', restaurante_nombre: 'R1', restaurante_slug: 'r1' };
}

function setDb(restaurantRow, dishRows) {
  stubDb.query = async (sql) => {
    if (/FROM restaurantes/i.test(sql) && !/platillos/i.test(sql)) return { rows: restaurantRow ? [restaurantRow] : [] };
    if (/FROM platillos/i.test(sql)) return { rows: dishRows || [] };
    return { rows: [] };
  };
}

function mockMlOk(dishIds) {
  return async (url, payload) => {
    const rid = (payload && payload.requestId) || 'req_t';
    if (String(url).endsWith('/interpret')) return { data: { requestId: rid, extracted: { allergies: [], diet: 'none', excludedIngredients: [], ambiguous: false } } };
    if (String(url).endsWith('/rank')) return { data: { requestId: rid, ranked: dishIds.map((id, i) => ({ dishId: id, score: 0.9 - i * 0.1, reasons: ['ok'] })) } };
    throw new Error('unexpected ' + url);
  };
}

test('DEC-012 handler: por-restaurante éxito -> envelope canónico 200', async () => {
  const orig = axios.post;
  axios.post = mockMlOk(['d1', 'd2']);
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [dishRow('d1', 'Taco'), dishRow('d2', 'Sopa')]);
    const req = { params: { restaurant_id: 'r1' }, body: { craving: { text: 'tacos' }, restrictions: { allergies: [], diet: 'none', excludedIngredients: [] }, options: { limit: 5, locale: 'es-MX', requestId: 'req_t' } } };
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['error', 'meta', 'recommendations', 'requestId', 'safety', 'status'].sort());
    assert.equal(res.body.requestId, 'req_t');
    assert.equal(res.body.status.code, 'ok');
    assert.equal(res.body.safety.overall, 'compatible_segun_datos');
    assert.equal(res.body.error, null);
    assert.ok(Array.isArray(res.body.recommendations) && res.body.recommendations.length === 2);
    assert.equal(res.body.meta.scope.type, 'restaurant');
    assert.equal(res.body.meta.scope.restaurantId, 'r1');
    assert.equal(res.body.meta.restaurant_id, 'r1'); // legacy conservado (no romper b1t05)
    assert.equal(res.body.meta.limitApplied, 5);
    assert.equal(res.body.meta.returned, 2);
    assert.equal(res.body.meta.mlUsed, true);
  } finally { axios.post = orig; }
});

test('DEC-012 handler: sin candidatos verificables -> 200 no_verified_results', async () => {
  const orig = axios.post;
  axios.post = async () => { throw new Error('should not be called for empty'); };
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, []); // sin platillos
    const req = { params: { restaurant_id: 'r1' }, body: { options: { requestId: 'req_n' } } };
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.recommendations, []);
    assert.equal(res.body.status.code, 'no_verified_results');
    assert.equal(res.body.safety.overall, 'sin_resultados_verificables');
    assert.equal(res.body.error, null);
  } finally { axios.post = orig; }
});

test('DEC-012 handler: campo desconocido -> 400 INVALID_REQUEST', async () => {
  const req = { params: { restaurant_id: 'r1' }, body: { craving: { text: 'x' }, hackField: 1 } };
  const res = makeRes();
  await getPublicRecommendations(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST');
  assert.equal(res.body.status.code, 'invalid_request');
  assert.deepEqual(res.body.recommendations, []);
  assert.ok(res.body.safety);
  assert.ok(res.body.requestId);
});

test('DEC-012 handler: locale inválido -> 400 INVALID_REQUEST con detalle locale', async () => {
  const req = { params: { restaurant_id: 'r1' }, body: { options: { locale: '!!!' } } };
  const res = makeRes();
  await getPublicRecommendations(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST');
  assert.ok(res.body.status.details.some((d) => String(d.field).includes('locale')));
});

test('DEC-012 handler: body vacío aplica defaults (limit 5, requestId generado)', async () => {
  const orig = axios.post;
  axios.post = mockMlOk(['d1']);
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [dishRow('d1', 'Taco')]);
    const req = { params: { restaurant_id: 'r1' }, body: {} };
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.meta.limitApplied, 5);
    assert.ok(typeof res.body.requestId === 'string' && res.body.requestId.startsWith('req_'));
  } finally { axios.post = orig; }
});

test('DEC-012 handler: restaurante inexistente -> 404 envelope uniforme', async () => {
  setDb(null, []);
  const req = { params: { restaurant_id: 'no-existe' }, body: { options: { requestId: 'req_404' } } };
  const res = makeRes();
  await getPublicRecommendations(req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(res.body.status.code, 'not_found');
  assert.equal(res.body.requestId, 'req_404');
  assert.deepEqual(res.body.recommendations, []);
  assert.ok(res.body.safety);
});

test('DEC-012 handler: restaurante inactivo -> 403 envelope uniforme', async () => {
  setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: false, slug: 'r1' }, []);
  const req = { params: { restaurant_id: 'r1' }, body: { options: { requestId: 'req_403' } } };
  const res = makeRes();
  await getPublicRecommendations(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'RESTAURANT_UNAVAILABLE');
  assert.equal(res.body.status.code, 'restaurant_unavailable');
});

test('DEC-012 handler: global éxito -> mismo envelope, scope global', async () => {
  const orig = axios.post;
  axios.post = mockMlOk(['d1', 'd2']);
  try {
    setDb(null, [dishRow('d1', 'Taco'), dishRow('d2', 'Sopa')]);
    const req = { body: { craving: { text: 'tacos' }, options: { limit: 5, requestId: 'req_g' } } };
    const res = makeRes();
    await getGlobalRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['error', 'meta', 'recommendations', 'requestId', 'safety', 'status'].sort());
    assert.equal(res.body.status.code, 'ok');
    assert.equal(res.body.meta.scope.type, 'global');
    assert.equal(res.body.requestId, 'req_g');
    assert.equal(res.body.meta.returned, 2);
  } finally { axios.post = orig; }
});

test('DEC-012 handler: global sin candidatos -> no_verified_results', async () => {
  setDb(null, []);
  const req = { body: { options: { requestId: 'req_gn' } } };
  const res = makeRes();
  await getGlobalRecommendations(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status.code, 'no_verified_results');
  assert.deepEqual(res.body.recommendations, []);
});

test('DEC-012 handler: ambas rutas comparten el mismo contrato (mismas keys de envelope)', async () => {
  const orig = axios.post;
  axios.post = mockMlOk(['d1']);
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [dishRow('d1', 'Taco')]);
    const rp = { params: { restaurant_id: 'r1' }, body: { options: { requestId: 'req_a' } } };
    const rg = { body: { options: { requestId: 'req_b' } } };
    const resp = makeRes(); const resg = makeRes();
    await getPublicRecommendations(rp, resp);
    await getGlobalRecommendations(rg, resg);
    assert.deepEqual(Object.keys(resp.body).sort(), Object.keys(resg.body).sort());
    assert.deepEqual(Object.keys(resp.body.meta).sort(), Object.keys(resg.body.meta).sort());
    assert.deepEqual(Object.keys(resp.body.safety).sort(), Object.keys(resg.body.safety).sort());
  } finally { axios.post = orig; }
});

test('DEC-012 handler: requestId del cliente se propaga en la respuesta', async () => {
  const orig = axios.post;
  axios.post = mockMlOk(['d1']);
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [dishRow('d1', 'Taco')]);
    const req = { params: { restaurant_id: 'r1' }, body: { options: { requestId: 'client-req-xyz' } } };
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.body.requestId, 'client-req-xyz');
  } finally { axios.post = orig; }
});


test('DEC-012 deduplicaci?n y safety por platillo en ambas rutas', async () => {
  const orig = axios.post; axios.post = mockMlOk(['d1']);
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [dishRow('d1', 'Taco')]);
    const normalized = normalizeRecommendationRequest({ craving: { tags: [' taco ', 'taco'] }, restrictions: { allergies: [' leche ', 'leche'], excludedIngredients: [' cebolla ', 'cebolla'] } });
    assert.deepEqual(normalized.canonical.craving.tags, ['taco']);
    assert.deepEqual(normalized.canonical.restrictions.allergies, ['leche']);
    assert.deepEqual(normalized.canonical.restrictions.excludedIngredients, ['cebolla']);
    for (const [handler, req] of [[getPublicRecommendations, { params: { restaurant_id: 'r1' }, body: {} }], [getGlobalRecommendations, { body: {} }]]) {
      const res = makeRes(); await handler(req, res); const item = res.body.recommendations[0];
      assert.equal(item.safety.overall, 'compatible_segun_datos'); assert.deepEqual(item.safety.restrictions, []);
      assert.equal(item.match.score, item.matchScore); assert.equal(typeof item.reasons[0].text, 'string');
    }
  } finally { axios.post = orig; }
});

test('DEC-012 rechaza campos anidados desconocidos en ambas rutas', async () => {
  for (const [handler, req] of [[getPublicRecommendations, { params: { restaurant_id: 'r1' }, body: { restrictions: { safety: true } } }], [getGlobalRecommendations, { body: { restrictions: { safety: true } } }]]) {
    const res = makeRes(); await handler(req, res); assert.equal(res.statusCode, 400); assert.equal(res.body.error.code, 'INVALID_REQUEST');
  }
});

test('DEC-012 fallback con ranking vac?o no atribuye ranking a ML', async () => {
  const orig = axios.post; axios.post = mockMlOk([]);
  try { setDb(null, [dishRow('d1', 'Taco')]); const res = makeRes(); await getGlobalRecommendations({ body: {} }, res);
    assert.equal(res.body.meta.fallback, true); assert.equal(res.body.meta.mlUsed, false); assert.equal(res.body.recommendations.length, 1);
  } finally { axios.post = orig; }
});


test('DEC-012 datos canonicos provienen de filas y ausencia no inventa precio ni arrays', async () => {
  const orig = axios.post; axios.post = mockMlOk(['d1']);
  try {
    const row = { ...dishRow('d1', 'Real'), precio: null, ingredientes_principales: null, etiquetas_dieteticas: null, categoria_nombre: null };
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [row]);
    for (const [handler, req] of [[getPublicRecommendations, { params: { restaurant_id: 'r1' }, body: {} }], [getGlobalRecommendations, { body: {} }]]) {
      const res = makeRes(); await handler(req, res);
      const dish = res.body.recommendations[0].dish;
      assert.equal(dish.name, 'Real'); assert.equal(dish.restaurantId, 'r1'); assert.equal(dish.active, true);
      for (const key of ['price', 'precio', 'ingredients', 'ingredientes_principales', 'dietaryTags', 'etiquetas_dieteticas', 'category', 'categoria_nombre']) assert.equal(Object.hasOwn(dish, key), false, key);
    }
  } finally { axios.post = orig; }
});

test('DEC-012 limite aprobado acepta 10 y rechaza 11', () => {
  assert.equal(normalizeRecommendationRequest({ options: { limit: 10 } }).limitApplied, 10);
  assert.equal(normalizeRecommendationRequest({ options: { limit: 11 } }).ok, false);
});


test('DEC-002 presupuesto no verificable se filtra antes de rank en ambas rutas', async () => {
  const orig = axios.post; const urls = [];
  axios.post = async (url, payload) => {
    urls.push(String(url));
    if (String(url).endsWith('/interpret')) return { data: { requestId: payload.requestId, extracted: { allergies: [], diet: 'none', excludedIngredients: [], budget: { amount: 10000, ambiguous: true } } } };
    throw new Error('rank should not receive unverifiable candidates');
  };
  try {
    setDb({ id: 'r1', nombre_negocio: 'R1', suscripcion_activa: true, slug: 'r1' }, [dishRow('d1', 'Taco')]);
    for (const [handler, req] of [[getPublicRecommendations, { params: { restaurant_id: 'r1' }, body: { restrictions: { budgetMax: 50 } } }], [getGlobalRecommendations, { body: { restrictions: { budgetMax: 50 } } }]]) {
      const res = makeRes(); await handler(req, res);
      assert.equal(res.body.status.code, 'no_verified_results'); assert.deepEqual(res.body.recommendations, []);
      assert.equal(res.body.safety.hasUnverifiableRestrictions, true);
    }
    assert.equal(urls.length, 2); assert.ok(urls.every(url => url.endsWith('/interpret')));
  } finally { axios.post = orig; }
});


test('exclusiones textuales distintas no desaparecen y conservan trazabilidad', () => {
  const { sanitizeMlExtractionForConsolidation } = require('../../src/controllers/menuController');
  const { consolidateRestrictions } = require('../../src/services/restrictionConsolidation');
  const { evaluateEligibility } = require('../../src/services/eligibilityService');
  const text = 'Quiero pollo, sin cebolla';
  const input = sanitizeMlExtractionForConsolidation({ excludedIngredients: ['cebolla'], negations: ['cebolla'] }, { excludedIngredients: ['puerco'] }, text);
  const result = consolidateRestrictions({ structuredRestrictions: { excludedIngredients: ['puerco'] }, mlExtraction: input });
  assert.ok(result.consolidatedRestrictions.some(r => r.origin === 'structured' && r.normalizedValue === 'puerco'));
  const inferred = result.consolidatedRestrictions.find(r => r.origin === 'ml_extraction' && r.normalizedValue === 'cebolla');
  assert.ok(inferred); assert.equal(inferred.raw.sourceText, text); assert.equal(inferred.state, 'desconocido');
  assert.equal(evaluateEligibility([{ id: 'd', ingredientes_principales: ['pollo'] }], result).eligibleCount, 0);
});

test('interpretacion ML malformada no elimina una restriccion textual', async () => {
  const { callMlInterpret } = require('../../src/controllers/menuController');
  const orig = axios.post; axios.post = async () => ({ data: { requestId: 'req_bad', extracted: { excludedIngredients: 'puerco' } } });
  try {
    const result = await callMlInterpret({ requestId: 'req_bad', craving: { text: 'sin puerco' }, restrictions: {}, options: { limit: 5 } });
    assert.equal(result.ok, false); assert.equal(result.meta.reason, 'invalid_extracted');
  } finally { axios.post = orig; }
});

for (const scenario of ['text_only', 'budget', 'text_budget', 'revoked_during_rank', 'price_changed_during_rank', 'rank_down']) {
  test(`R3 both public handlers with synthetic DB and ML: ${scenario}`, async () => {
    const { randomUUID } = require('node:crypto');
    const { SECTIONS } = require('../../src/services/catalogEvidence');
    const { computeRecipeVersion } = require('../../src/services/catalogVerification');
    const orig = axios.post;
    try {
      for (const handler of [getPublicRecommendations, getGlobalRecommendations]) {
        const rid = randomUUID(), did = randomUUID(), revision = randomUUID();
        const row = { ...dishRow(did, 'Pollo picante'), restaurante_id: rid, restaurante_activo: true,
          evidencia_precio_revision: randomUUID(), evidencia_receta_revision: randomUUID(), precio: '37.50',
          ...Object.fromEntries(SECTIONS.map(s => [s, []])), ingredientes_principales: ['pollo', 'chile'] };
        const base = { restaurante_id: rid, platillo_id: did, actor_id: rid, actor_tipo: 'RESTAURANTE',
          confirmado_en: '2026-11-15', procedencia: 'Fixture sintetico' };
        row.evidence_taxonomy = [{ grupo: 'cerdo', version: 1, revision, estado: 'aprobada', aprobado_por: rid,
          aprobado_en: '2026-11-15', terms: ['cerdo', 'puerco'].map(t => ({ termino_normalizado: t, relacion: 'sinonimo' })) }];
        row.evidence_absences = [{ ...base, grupo: 'cerdo', taxonomia_version: 1, taxonomia_revision: revision,
          receta_version: computeRecipeVersion(row), receta_revision: row.evidencia_receta_revision,
          secciones: Object.fromEntries(SECTIONS.map(s => [s, 'complete'])) }];
        row.evidence_prices = ['budget', 'text_budget'].includes(scenario) ? [{ ...base, moneda: 'MXN', precio_confirmado: '37.50',
          version_precio: row.evidencia_precio_revision }] : [];
        setDb({ id: rid, nombre_negocio: 'R', suscripcion_activa: true, slug: 'r' }, [row]);
        let ranks = 0;
        axios.post = async (url, payload) => {
          if (url.endsWith('/interpret')) return { data: { requestId: payload.requestId,
            extracted: { excludedIngredients: scenario === 'text_budget' ? [] : ['puerco'], allergies: [], diet: 'none', ambiguous: false,
              ...(scenario === 'text_budget' ? { budget: { amount: 37.50, currency: 'MXN', ambiguous: false } } : {}) } } };
          ranks++;
          assert.deepEqual(payload.candidates.map(d => d.id), [did]);
          if (scenario === 'revoked_during_rank') row.evidence_absences[0].revocado_en = '2026-11-16';
          if (scenario === 'price_changed_during_rank') row.evidencia_precio_revision = randomUUID();
          if (scenario === 'rank_down') throw Error('synthetic rank unavailable');
          return { data: { requestId: payload.requestId, ranked: [{ dishId: did, score: 0.9, reasons: ['picante'] }] } };
        };
        const res = makeRes();
        await handler({ params: { restaurant_id: rid }, body: {
          craving: { text: scenario === 'text_budget' ? 'Tengo 37.50 pesos y quiero tacos' : 'Quiero algo picoso, pero que no tenga puerco' },
          ...(scenario === 'budget' ? { restrictions: { budgetMax: 37.50 } } : {}) } }, res);
        assert.equal(res.statusCode, 200); assert.equal(ranks, 1);
        const changed = scenario.includes('during_rank');
        assert.equal(res.body.recommendations.length, changed ? 0 : 1);
        if (changed) assert.equal(res.body.status.code, 'no_verified_results');
        if (scenario === 'rank_down') assert.equal(res.body.meta.fallback, true);
        assert.equal(res.body.meta.limitApplied, 5);
      }
    } finally { axios.post = orig; }
  });
}

test('R3 legacy approval also rejects delegated superadmin before database access', async () => {
  const { approveDishVerification } = require('../../src/controllers/menuController');
  const res = makeRes();
  await approveDishVerification({ user: { id: 'admin', rol: 'SUPER_ADMIN' }, params: { id: 'dish' }, body: { verification_metadata: { verified: true } } }, res);
  assert.equal(res.statusCode, 403);
});

test('R3 legacy approval rejects stale owner token after stored role changes', async () => {
  const { approveDishVerification } = require('../../src/controllers/menuController');
  const oldConnect = stubDb.pool.connect;
  const calls = [];
  stubDb.pool.connect = async () => ({ query: async sql => { calls.push(sql); return { rows: [] }; }, release: () => {} });
  try {
    const res = makeRes();
    await approveDishVerification({ user: { id: 'owner', rol: 'RESTAURANTE' }, params: { id: 'dish' }, body: { verification_metadata: {} } }, res);
    assert.equal(res.statusCode, 403);
    assert.ok(calls.some(sql => sql.includes('FROM restaurantes')));
    assert.ok(!calls.some(sql => sql.includes('FROM platillos')));
    assert.ok(calls.includes('ROLLBACK'));
  } finally { stubDb.pool.connect = oldConnect; }
});

test('R3 both endpoints fail closed when ML omits an explicit textual exclusion', async () => {
  const orig = axios.post; let ranks = 0;
  axios.post = async (url, payload) => {
    if (url.endsWith('/interpret')) return { data: { requestId: payload.requestId,
      extracted: { excludedIngredients: [], allergies: [], diet: 'none', ambiguous: false } } };
    ranks++; return { data: { requestId: payload.requestId, ranked: [{ dishId: 'd1', score: 1 }] } };
  };
  try {
    setDb({ id: 'r1', nombre_negocio: 'R', suscripcion_activa: true, slug: 'r' }, [dishRow('d1', 'Pollo')]);
    for (const handler of [getPublicRecommendations, getGlobalRecommendations]) {
      const res = makeRes();
      await handler({ params: { restaurant_id: 'r1' }, body: { craving: { text: 'Quiero algo picoso, pero que no tenga puerco' } } }, res);
      assert.equal(res.body.status.code, 'no_verified_results');
      assert.deepEqual(res.body.recommendations, []);
      assert.equal(res.body.safety.hasUnverifiableRestrictions, true);
    }
    assert.equal(ranks, 0);
  } finally { axios.post = orig; }
});

test('R3 partial ML extraction cannot conceal a second explicit exclusion', async () => {
  const orig = axios.post; let ranks = 0;
  axios.post = async (url, payload) => {
    if (url.endsWith('/interpret')) return { data: { requestId: payload.requestId,
      extracted: { excludedIngredients: ['puerco'], allergies: [], diet: 'none', ambiguous: false } } };
    ranks++; return { data: { requestId: payload.requestId, ranked: [] } };
  };
  try {
    setDb({ id: 'r1', nombre_negocio: 'R', suscripcion_activa: true, slug: 'r' }, [dishRow('d1', 'Pollo')]);
    for (const text of ['sin puerco ni cebolla', 'sin puerco y sin gluten']) {
      for (const handler of [getPublicRecommendations, getGlobalRecommendations]) {
        const res = makeRes(); await handler({ params: { restaurant_id: 'r1' }, body: { craving: { text } } }, res);
        assert.equal(res.body.status.code, 'no_verified_results');
      }
    }
    assert.equal(ranks, 0);
  } finally { axios.post = orig; }
});

test('R3 both endpoints fail closed when ML omits a textual vegetarian or vegan diet', async () => {
  const orig = axios.post; let ranks = 0;
  axios.post = async (url, payload) => {
    if (url.endsWith('/interpret')) return { data: { requestId: payload.requestId,
      extracted: { excludedIngredients: [], allergies: [], diet: 'none', ambiguous: false } } };
    ranks++; return { data: { requestId: payload.requestId, ranked: [] } };
  };
  try {
    setDb({ id: 'r1', nombre_negocio: 'R', suscripcion_activa: true, slug: 'r' }, [dishRow('d1', 'Pollo')]);
    for (const text of ['Quiero algo vegetariano', 'Quiero una opción vegana', 'Tengo alergia a cacahuate', 'Quiero tacos por 100 pesos']) {
      for (const handler of [getPublicRecommendations, getGlobalRecommendations]) {
        const res = makeRes(); await handler({ params: { restaurant_id: 'r1' }, body: { craving: { text } } }, res);
        assert.equal(res.body.status.code, 'no_verified_results');
      }
    }
    assert.equal(ranks, 0);
  } finally { axios.post = orig; }
});
