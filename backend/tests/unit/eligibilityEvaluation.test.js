const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidateRestrictions,
  STATES
} = require('../../src/services/restrictionConsolidation');
const {
  evaluateDishEligibility,
  evaluateEligibility,
  buildSafeFallbackRecommendations
} = require('../../src/services/eligibilityService');
const { resolveAllergensForTerm } = require('../../src/services/allergenCatalog');
const { computeRecipeVersion } = require('../../src/services/catalogVerification');

function makeVerifiedDish(baseOverrides = {}, opts = {}) {
  const base = {
    id: 'd1',
    nombre: 'Platillo',
    descripcion: '',
    precio: 100,
    ingredientes_principales: [],
    complementos: [],
    etiquetas_dieteticas: [],
    ...baseOverrides
  };
  const allIngredientTerms = [];
  const collect = (arr) => {
    (Array.isArray(arr) ? arr : []).forEach((v) => {
      if (typeof v === 'string') allIngredientTerms.push(v);
      else if (v && typeof v === 'object') {
        if (v.name) allIngredientTerms.push(v.name);
        if (Array.isArray(v.subIngredients)) v.subIngredients.forEach((s) => { if (typeof s === 'string') allIngredientTerms.push(s); else if (s && s.name) allIngredientTerms.push(s.name); });
        if (Array.isArray(v.ingredientes_componentes)) v.ingredientes_componentes.forEach((s) => { if (typeof s === 'string') allIngredientTerms.push(s); else if (s && s.name) allIngredientTerms.push(s.name); });
      }
    });
  };
  collect(base.ingredientes_principales);
  collect(base.ingredientes_secundarios);
  collect(base.complementos);
  collect(base.salsas);
  collect(base.aderezos);
  collect(base.condimentos);
  collect(base.ingredientes_compuestos);

  const assessments = [];
  const assessedAllergens = Array.isArray(opts.assessedAllergens) ? opts.assessedAllergens : [];
  assessedAllergens.forEach((alg) => {
    allIngredientTerms.forEach((term) => {
      const res = resolveAllergensForTerm(term);
      if (res.allergens.includes(alg)) return;
      assessments.push({ term, allergen: alg, state: 'verified_absent', source: 'test_verified' });
    });
  });

  const meta = {
    completeness: {
      ingredientes_principales: 'complete',
      ingredientes_secundarios: 'not_applicable_declared',
      complementos: 'not_applicable_declared',
      salsas: 'not_applicable_declared',
      aderezos: 'not_applicable_declared',
      condimentos: 'not_applicable_declared',
      ingredientes_compuestos: 'not_applicable_declared',
      sustituciones_permitidas: 'not_applicable_declared',
      modificadores_opcionales: 'not_applicable_declared',
      contacto_cruzado: 'complete'
    },
    crossContamination: { status: opts.crossContamination || 'verified_controlled' },
    verificationState: 'verified_approved',
    verifiedBy: 'verifier-1',
    verifiedAt: '2026-11-10T00:00:00Z',
    verificationSource: 'test',
    ingredientAllergenAssessments: assessments,
    ...(opts.meta || {})
  };
  const dish = { ...base, verification_metadata: meta };
  dish.verification_metadata.verifiedRecipeVersion = computeRecipeVersion(dish);
  if (opts.currentRecipeVersionMismatch) dish.ingredientes_principales = [...(dish.ingredientes_principales || []), 'cambio'];
  return dish;
}

function dish(overrides = {}) {
  return {
    id: overrides.id || 'd1',
    nombre: overrides.nombre || 'Platillo',
    descripcion: overrides.descripcion || '',
    precio: overrides.precio != null ? overrides.precio : 100,
    ingredientes_principales: overrides.ingredientes_principales || [],
    complementos: overrides.complementos || [],
    etiquetas_dieteticas: overrides.etiquetas_dieteticas || [],
    ...overrides
  };
}

function compatibleConsolidation(structured, ml = null, requestId = 'req_e') {
  const c = consolidateRestrictions({ requestId, structuredRestrictions: structured, mlExtraction: ml });
  c.consolidatedRestrictions = c.consolidatedRestrictions.map((r) => ({
    ...r,
    state: STATES.COMPATIBLE_SEGUN_DATOS,
    reason: 'structured_preserved_for_eligibility_check'
  }));
  return c;
}

test('B1-T04 Elegibilidad y fallback seguro (integrado con verificación de catálogo)', async (t) => {
  await t.test('1. Platillo con evidencia verificada suficiente de ausencia => elegible', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_e1');
    const d = makeVerifiedDish({ id: 'd1', ingredientes_principales: ['pollo', 'arroz'], complementos: ['ensalada'] }, { assessedAllergens: ['cacahuate'] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, true);
    assert.equal(ev.decision, 'eligible_verified');
  });

  await t.test('2. Platillo con evidencia de incompatibilidad (alérgeno presente mapeado) => descartado', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_e2');
    const d = makeVerifiedDish({ id: 'd2', ingredientes_principales: ['pollo', 'mani'], complementos: [] }, { assessedAllergens: ['cacahuate'] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
    assert.equal(ev.decision, 'discarded_incompatible');
    assert.ok(ev.evaluations.some((e) => e.state === STATES.INCOMPATIBLE));
  });

  await t.test('3. Platillo sin información/verificación suficiente -> desconocido/no elegible', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_e3');
    const d = dish({ id: 'd3', ingredientes_principales: ['pollo'], complementos: [] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
    assert.equal(ev.decision, 'not_verifiable');
    assert.ok(ev.evaluations.some((e) => e.state === STATES.DESCONOCIDO));
  });

  await t.test('4. Alergia explícita sin verificación/evaluación del catálogo -> no compatible', () => {
    const c = consolidateRestrictions({ requestId: 'req_e4', structuredRestrictions: { allergies: ['gluten'] }, mlExtraction: null });
    const d = dish({ ingredientes_principales: ['pollo'], complementos: [] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
    assert.notEqual(ev.decision, 'eligible_verified');
  });

  await t.test('5. Dieta explícita sin evidencia verificada -> no elegible', () => {
    const c = compatibleConsolidation({ diet: 'vegan' }, null, 'req_e5');
    const d = makeVerifiedDish({ ingredientes_principales: ['tofu'], etiquetas_dieteticas: [] }, { assessedAllergens: [] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
    assert.ok(ev.evaluations.some((e) => e.category === 'diet' && e.state === STATES.DESCONOCIDO));
  });

  await t.test('6. Restricción contradictoria estructurada vs extracción ML -> desconocido, no elegible', () => {
    const c = consolidateRestrictions({ requestId: 'req_e6', structuredRestrictions: { diet: 'vegan' }, mlExtraction: { diet: 'none' } });
    const d = makeVerifiedDish({ ingredientes_principales: ['verduras'], etiquetas_dieteticas: ['vegano'] }, { assessedAllergens: [] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
    assert.ok(c.consolidatedRestrictions.some((r) => r.reason === 'contradiction_unresolved_protective'));
  });

  await t.test('7. Restricciones múltiples simultáneas se evalúan todas', () => {
    const c = compatibleConsolidation({ allergies: ['mani'], excludedIngredients: ['cebolla'] }, null, 'req_e7');
    const d = makeVerifiedDish({ ingredientes_principales: ['pollo', 'cebolla'], complementos: [] }, { assessedAllergens: ['cacahuate'] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
    assert.ok(ev.evaluations.some((e) => e.category === 'exclusion' && e.state === STATES.INCOMPATIBLE));
    assert.equal(ev.evaluations.length >= 2, true);
  });

  await t.test('8. Exclusiones y negaciones explícitas impiden elegibilidad si hay evidencia de presencia', () => {
    const c = compatibleConsolidation({ excludedIngredients: ['camaron'] }, null, 'req_e8');
    const d = makeVerifiedDish({ ingredientes_principales: ['camaron', 'ajo'] }, { assessedAllergens: ['crustaceos'] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.eligible, false);
  });

  await t.test('9. Fallback con cero platillos elegibles devuelve vacío', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_e9');
    const candidates = [
      makeVerifiedDish({ id: 'a', ingredientes_principales: ['mani'] }, { assessedAllergens: ['cacahuate'] }),
      dish({ id: 'b', ingredientes_principales: ['pollo'] })
    ];
    const result = evaluateEligibility(candidates, c, { limit: 5 });
    assert.equal(result.eligible.length, 0);
    const recs = buildSafeFallbackRecommendations(result.eligible, { limit: 5, restaurantId: 'r1', restaurantName: 'R', restaurantSlug: 'r', menuUrl: '/menu/r' });
    assert.deepEqual(recs, []);
  });

  await t.test('10. Fallback con menos resultados que el límite solicitado devuelve solo elegibles', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_e10');
    const candidates = [
      makeVerifiedDish({ id: 'a', nombre: 'A', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'] }),
      makeVerifiedDish({ id: 'b', nombre: 'B', ingredientes_principales: ['mani'] }, { assessedAllergens: ['cacahuate'] }),
      dish({ id: 'c', nombre: 'C', ingredientes_principales: ['pollo'] })
    ];
    const result = evaluateEligibility(candidates, c, { limit: 5 });
    assert.equal(result.eligible.length, 1);
    const recs = buildSafeFallbackRecommendations(result.eligible, { limit: 5, restaurantId: 'r1', restaurantName: 'R', restaurantSlug: 'r', menuUrl: '/menu/r' });
    assert.equal(recs.length, 1);
    assert.equal(recs[0].dish.id, 'a');
  });

  await t.test('11. Prevención de recomendaciones incompatibles', () => {
    const c = compatibleConsolidation({ allergies: ['gluten'] }, null, 'req_e11');
    const candidates = [
      makeVerifiedDish({ id: 'bad', ingredientes_principales: ['pan'] }, { assessedAllergens: ['gluten'] }),
      makeVerifiedDish({ id: 'ok', ingredientes_principales: ['arroz'] }, { assessedAllergens: ['gluten'] })
    ];
    const result = evaluateEligibility(candidates, c, { limit: 5 });
    assert.ok(!result.eligible.some((d) => d.id === 'bad'));
    assert.ok(result.eligible.some((d) => d.id === 'ok'));
  });

  await t.test('12. Conservación de requestId y trazabilidad', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_trace_12');
    const d = makeVerifiedDish({ id: 'x', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'] });
    const ev = evaluateDishEligibility(d, c);
    assert.equal(ev.trace.requestId, 'req_trace_12');
    assert.ok(Array.isArray(ev.evaluations));
    const agg = evaluateEligibility([d], c, { limit: 5 });
    assert.equal(agg.requestId, 'req_trace_12');
  });

  await t.test('Correctiva: contacto cruzado posible y receta invalidada impiden elegibilidad', () => {
    const c = compatibleConsolidation({ allergies: ['mani'] }, null, 'req_e13');
    const ccDish = makeVerifiedDish({ id: 'cc', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], crossContamination: 'possible' });
    assert.equal(evaluateDishEligibility(ccDish, c).eligible, false);
    const inv = makeVerifiedDish({ id: 'inv', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'] });
    inv.ingredientes_principales = ['pollo', 'arroz'];
    assert.equal(evaluateDishEligibility(inv, c).eligible, false);
  });
});
