const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { consolidateRestrictions, STATES } = require('../../src/services/restrictionConsolidation');
const { evaluateEligibility, buildSafeFallbackRecommendations } = require('../../src/services/eligibilityService');
const { computeRecipeVersion } = require('../../src/services/catalogVerification');
const { resolveAllergensForTerm } = require('../../src/services/allergenCatalog');

function verifiedDish(baseOverrides = {}, opts = {}) {
  const base = {
    id: 'd1', nombre: 'Platillo', descripcion: '', precio: 100,
    ingredientes_principales: [], ingredientes_secundarios: [], complementos: [],
    salsas: [], aderezos: [], condimentos: [], ingredientes_compuestos: [],
    sustituciones_permitidas: [], modificadores_opcionales: [],
    etiquetas_dieteticas: [], alergenos_declarados: [], contacto_cruzado: null,
    ...baseOverrides
  };
  const terms = [];
  const collect = (arr) => (Array.isArray(arr) ? arr : []).forEach((v) => {
    if (typeof v === 'string') terms.push(v);
    else if (v && typeof v === 'object') {
      if (v.name) terms.push(v.name);
      const subs = Array.isArray(v.subIngredients) ? v.subIngredients : (Array.isArray(v.ingredientes_componentes) ? v.ingredientes_componentes : []);
      subs.forEach((s) => { if (typeof s === 'string') terms.push(s); else if (s && s.name) terms.push(s.name); });
    }
  });
  ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos'].forEach((k) => collect(base[k]));
  const assessments = [];
  (opts.assessedAllergens || []).forEach((alg) => {
    terms.forEach((term) => {
      const r = resolveAllergensForTerm(term);
      if (r.allergens.includes(alg)) return;
      assessments.push({ term, allergen: alg, state: 'verified_absent', source: 'revision_manual' });
    });
  });
  const meta = {
    completeness: {
      ingredientes_principales: 'complete', ingredientes_secundarios: opts.incompleteSecondary ? 'incomplete' : 'not_applicable_declared',
      complementos: 'not_applicable_declared', salsas: opts.incompleteSauces ? 'incomplete' : 'not_applicable_declared',
      aderezos: opts.incompleteDressings ? 'incomplete' : 'not_applicable_declared', condimentos: opts.incompleteCondiments ? 'incomplete' : 'not_applicable_declared',
      ingredientes_compuestos: opts.incompleteCompounds ? 'incomplete' : 'not_applicable_declared',
      sustituciones_permitidas: 'not_applicable_declared', modificadores_opcionales: 'not_applicable_declared', contacto_cruzado: 'complete'
    },
    crossContamination: { status: opts.ccStatus || 'verified_controlled', ...(opts.ccAllergens ? { allergens: opts.ccAllergens } : {}) },
    verificationState: opts.verificationState || 'verified_approved',
    verifiedBy: opts.verifiedBy === undefined ? 'admin-1' : opts.verifiedBy,
    verifiedAt: opts.verifiedAt === undefined ? '2026-11-10T00:00:00Z' : opts.verifiedAt,
    verificationSource: 'revision_manual',
    ingredientAllergenAssessments: assessments,
    conflicts: opts.conflicts || [],
    ...(opts.meta || {})
  };
  const dish = { ...base, verification_metadata: meta };
  dish.verification_metadata.verifiedRecipeVersion = opts.verifiedRecipeVersionOverride || computeRecipeVersion(dish);
  if (opts.mutateAfterVerify) dish.ingredientes_principales = [...(dish.ingredientes_principales || []), 'ingrediente_extra'];
  return dish;
}

function compatible(structured, requestId = 'req_flow') {
  const c = consolidateRestrictions({ requestId, structuredRestrictions: structured, mlExtraction: null });
  c.consolidatedRestrictions = c.consolidatedRestrictions.map((r) => ({ ...r, state: STATES.COMPATIBLE_SEGUN_DATOS, reason: 'structured_for_flow_test' }));
  return c;
}

// Simula flujo: Catálogo -> Verificación -> Elegibilidad -> Filtrado ML -> Fallback -> Respuesta
function runFlow({ candidates, structured, limit = 5, mlRecommendations = null, requestId = 'req_flow' }) {
  const c = consolidateRestrictions({ requestId, structuredRestrictions: structured, mlExtraction: null });
  const elig = evaluateEligibility(candidates, c, { limit });
  const eligibleIds = new Set(elig.eligible.map((d) => String(d.id)));
  let final = [];
  let fallback = true;
  if (Array.isArray(mlRecommendations)) {
    const sanitized = mlRecommendations.filter((r) => r && r.dish && eligibleIds.has(String(r.dish.id)));
    if (sanitized.length > 0) { final = sanitized.slice(0, limit); fallback = false; }
  }
  if (final.length === 0) final = buildSafeFallbackRecommendations(elig.eligible, { limit, restaurantId: 'r1', restaurantName: 'R', restaurantSlug: 'r', menuUrl: '/menu/r' });
  return { consolidation: c, eligibility: elig, eligibleIds, final, fallback };
}

test('B1-T04 Correctiva - integración de flujo y prevención de falsos positivos (clases probadas)', async (t) => {
  await t.test('Negativo: ingrediente derivado contiene alérgeno solicitado', () => {
    const d = verifiedDish({ id: 'd1', ingredientes_principales: ['mantequilla_de_mani', 'arroz'] }, { assessedAllergens: ['cacahuate'] });
    const { final, eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
    assert.equal(final.length, 0);
  });

  await t.test('Negativo: ingrediente compuesto no desglosado', () => {
    const d = verifiedDish({ id: 'd1', ingredientes_principales: [{ name: 'salsa secreta', isCompound: true, compoundResolved: false }] }, { assessedAllergens: ['cacahuate'] });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Negativo: salsa/aderezos/condimentos/ingredientes secundarios incompletos o no declarados', () => {
    const base = { id: 'd1', ingredientes_principales: ['pollo'], salsas: ['salsa verde'], aderezos: ['aderezo'] };
    const d = verifiedDish(base, { assessedAllergens: ['cacahuate'], incompleteSauces: true, incompleteDressings: true, incompleteCondiments: true, incompleteSecondary: true });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Negativo: sección vacía pero no declarada completa (sin metadatos explícitos) => no elegible', () => {
    const d = { id: 'd1', nombre: 'X', ingredientes_principales: ['pollo'], complementos: [] }; // histórico sin verificación
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Negativo: información contradictoria entre fuentes', () => {
    const d = verifiedDish({ id: 'd1', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], conflicts: [{ allergen: 'cacahuate', reason: 'conflicto' }] });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Negativo: verificación de receta anterior / receta cambia tras verificación', () => {
    const d = verifiedDish({ id: 'd1', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], mutateAfterVerify: true });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Negativo: contacto cruzado sin evaluar y posible', () => {
    const d1 = verifiedDish({ id: 'd1', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], ccStatus: 'unknown' });
    const d2 = verifiedDish({ id: 'd2', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], ccStatus: 'not_assessed' });
    const d3 = verifiedDish({ id: 'd3', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], ccStatus: 'possible' });
    const r = runFlow({ candidates: [d1, d2, d3], structured: { allergies: ['mani'] } });
    assert.equal(r.eligibleIds.size, 0);
  });

  await t.test('Negativo: sin responsable de verificación / estado no aprobado', () => {
    const d = verifiedDish({ id: 'd1', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], verificationState: 'declared_unverified', verifiedBy: null, verifiedAt: null });
    // verifiedRecipeVersion matches but state not verified_approved
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Negativo: ML recomienda platillo no elegible y fallback no recupera desconocidos', () => {
    const eligible = verifiedDish({ id: 'ok', nombre: 'OK', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'] });
    const ineligible = verifiedDish({ id: 'bad', nombre: 'BAD', ingredientes_principales: ['mani'] }, { assessedAllergens: ['cacahuate'] });
    const unknownDish = { id: 'unk', nombre: 'UNK', ingredientes_principales: ['pollo'] };
    const ml = [
      { dish: { id: 'bad' }, restaurant: {}, matchScore: 0.9 },
      { dish: { id: 'unk' }, restaurant: {}, matchScore: 0.8 }
    ];
    const { final, eligibleIds } = runFlow({ candidates: [eligible, ineligible, unknownDish], structured: { allergies: ['mani'] }, mlRecommendations: ml });
    assert.ok(eligibleIds.has('ok'));
    assert.ok(!eligibleIds.has('bad'));
    assert.ok(!eligibleIds.has('unk'));
    assert.ok(final.every((r) => String(r.dish.id) === 'ok'));
  });

  await t.test('Negativo: etiqueta dietética sin evidencia vigente no vuelve elegible', () => {
    const d = verifiedDish({ id: 'd1', ingredientes_principales: ['verduras'], etiquetas_dieteticas: ['vegano'] }, { assessedAllergens: [] });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { diet: 'vegan' } });
    assert.equal(eligibleIds.has('d1'), false);
  });

  await t.test('Positivo: platillo completo y verificado con evaluaciones explícitas', () => {
    const d = verifiedDish({ id: 'ok', ingredientes_principales: ['pollo', 'arroz'] }, { assessedAllergens: ['cacahuate'] });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('ok'), true);
  });

  await t.test('Positivo: ingrediente compuesto desglosado y verificado con evaluaciones explícitas', () => {
    const d = verifiedDish({ id: 'ok', ingredientes_principales: [{ name: 'salsa', isCompound: true, compoundResolved: true, subIngredients: ['tomate', 'cebolla'] }] }, { assessedAllergens: ['cacahuate'] });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('ok'), true);
  });

  await t.test('Positivo: ausencia verificada vigente con contacto cruzado controlado', () => {
    const d = verifiedDish({ id: 'ok', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'], ccStatus: 'verified_controlled' });
    const { eligibleIds } = runFlow({ candidates: [d], structured: { allergies: ['mani'] } });
    assert.equal(eligibleIds.has('ok'), true);
  });

  await t.test('Integral: Catálogo→Verificación→Elegibilidad→Filtrado ML→Fallback→Respuesta sin no elegibles', () => {
    const ok = verifiedDish({ id: 'ok', nombre: 'Seguro', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'] });
    const bad = verifiedDish({ id: 'bad', nombre: 'Riesgo', ingredientes_principales: ['mani'] }, { assessedAllergens: ['cacahuate'] });
    const unk = { id: 'unk', nombre: 'Desconocido', ingredientes_principales: ['pollo'] };
    const ml = [
      { dish: { id: 'bad', nombre: 'Riesgo' }, restaurant: { id: 'r1' }, matchScore: 0.99 },
      { dish: { id: 'unk', nombre: 'Desconocido' }, restaurant: { id: 'r1' }, matchScore: 0.98 },
      { dish: { id: 'ok', nombre: 'Seguro' }, restaurant: { id: 'r1' }, matchScore: 0.5 }
    ];
    const res = runFlow({ candidates: [ok, bad, unk], structured: { allergies: ['mani'] }, mlRecommendations: ml, limit: 5 });
    assert.deepEqual(Array.from(res.eligibleIds), ['ok']);
    assert.equal(res.final.length, 1);
    assert.equal(String(res.final[0].dish.id), 'ok');
    assert.equal(res.fallback, false);
  });

  await t.test('Integral fallback: solo elegibles, sin completar límite artificialmente', () => {
    const ok = verifiedDish({ id: 'ok', nombre: 'Seguro', ingredientes_principales: ['pollo'] }, { assessedAllergens: ['cacahuate'] });
    const bad = { id: 'bad', nombre: 'Sin verificar', ingredientes_principales: ['pollo'] };
    const res = runFlow({ candidates: [ok, bad], structured: { allergies: ['mani'] }, mlRecommendations: [], limit: 5 });
    assert.equal(res.eligibleIds.size, 1);
    assert.equal(res.final.length, 1);
    assert.equal(String(res.final[0].dish.id), 'ok');
  });
});
