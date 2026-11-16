const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLERGEN_STATES,
  COMPLETENESS_STATES,
  VERIFICATION_STATES,
  CROSS_CONTAMINATION_STATES,
  evaluateAllergenForDish,
  computeRecipeVersion
} = require('../../src/services/catalogVerification');
const { resolveAllergensForTerm, resolveAllergenSet } = require('../../src/services/allergenCatalog');

function verifiedDish(overrides = {}) {
  const base = {
    id: 'p1',
    nombre: 'Ensalada',
    ingredientes_principales: ['pollo', 'lechuga'],
    complementos: [],
    etiquetas_dieteticas: [],
    verification_metadata: {
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
      crossContamination: { status: 'verified_controlled' },
      verificationState: 'verified_approved',
      verifiedBy: 'admin-1',
      verifiedAt: '2026-11-10T00:00:00Z',
      verificationSource: 'revision_manual'
    }
  };
  const merged = { ...base, ...overrides, verification_metadata: { ...(base.verification_metadata), ...(overrides.verification_metadata || {}) } };
  merged.verification_metadata.verifiedRecipeVersion = computeRecipeVersion(merged);
  return merged;
}

test('B1-T04 Catálogo/verificación de alérgenos', async (t) => {
  await t.test('Alérgenos: nombre canónico y sinónimos', () => {
    assert.equal(resolveAllergensForTerm('mani').directAllergen, 'cacahuate');
    assert.equal(resolveAllergensForTerm('cacahuete').directAllergen, 'cacahuate');
    assert.equal(resolveAllergensForTerm('leche').directAllergen, 'lacteos');
  });

  await t.test('Alérgenos: variaciones de escritura normalizadas', () => {
    assert.equal(resolveAllergensForTerm('  MANÍ  ').directAllergen, 'cacahuate');
    assert.equal(resolveAllergensForTerm('salsa de soya').allergens.includes('soya'), true);
  });

  await t.test('Alérgenos: derivados/compuestos documentados', () => {
    const r = resolveAllergenSet(['mantequilla_de_mani']);
    assert.ok(r.allergens.includes('cacahuate'));
    const s = resolveAllergenSet(['salsa de soya']);
    assert.ok(s.allergens.includes('soya'));
  });

  await t.test('Presencia documentada (ingrediente declarado mapeado) => contains', () => {
    const d = verifiedDish({ ingredientes_principales: ['pollo', 'mani'] });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.CONTAINS);
  });

  await t.test('Posible presencia (contacto cruzado documentado) => may_contain', () => {
    const d = verifiedDish({ ingredientes_principales: ['pollo'], verification_metadata: { crossContamination: { status: 'possible', allergens: ['cacahuate'] } } });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.MAY_CONTAIN);
  });

  await t.test('Ausencia verificada requiere evaluaciones explícitas por ingrediente/alérgeno (evidencia verificable)', () => {
    // Catálogo/receta completa y verificada, pero sin evaluaciones explícitas por término => no se puede probar ausencia
    const d0 = verifiedDish({ ingredientes_principales: ['pollo', 'arroz'] });
    const ev0 = evaluateAllergenForDish(d0, 'cacahuate');
    assert.equal(ev0.allergenState, ALLERGEN_STATES.UNKNOWN);
    assert.equal(ev0.reason, 'ingredient_allergen_assessment_missing');

    // Con evaluaciones explícitas verificadas por término para el alérgeno solicitado => verified_absent
    const d = verifiedDish({
      ingredientes_principales: ['pollo', 'arroz'],
      verification_metadata: {
        ingredientAllergenAssessments: [
          { term: 'pollo', allergen: 'cacahuate', state: 'verified_absent', source: 'revision_manual' },
          { term: 'arroz', allergen: 'cacahuate', state: 'verified_absent', source: 'revision_manual' }
        ]
      }
    });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.VERIFIED_ABSENT);
  });

  await t.test('Ausencia sin verificación (sin metadatos) => unknown', () => {
    const d = { id: 'p2', ingredientes_principales: ['pollo', 'arroz'], complementos: [] };
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
  });

  await t.test('Ingrediente compuesto no resuelto bloquea verificación', () => {
    const d = verifiedDish({ ingredientes_principales: [{ name: 'salsa especial', isCompound: true, compoundResolved: false }] });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
  });

  await t.test('Ingrediente compuesto desglosado requiere evaluaciones explícitas para ausencia verificada', () => {
    const d = verifiedDish({ ingredientes_principales: [{ name: 'salsa especial', isCompound: true, compoundResolved: true, subIngredients: ['tomate', 'cebolla'] }] });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
    assert.equal(ev.reason, 'ingredient_allergen_assessment_missing');
  });

  await t.test('Conflicto entre fuentes => unknown', () => {
    const d = verifiedDish({ verification_metadata: { conflicts: [{ allergen: 'cacahuate', reason: 'fuentes contradictorias' }] } });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
    assert.equal(ev.reason, 'conflict_between_sources');
  });

  await t.test('Datos desactualizados/modificados tras verificación invalidan => unknown', () => {
    const d = verifiedDish({ ingredientes_principales: ['pollo'] });
    d.ingredientes_principales = ['pollo', 'mani'];
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
    assert.equal(ev.verification.state, VERIFICATION_STATES.INVALIDATED_BY_CHANGE);
  });

  await t.test('Completitud: ingredientes secundarios/salsas/aderezos/condimentos no declarados => insuficiente', () => {
    const d = verifiedDish({ verification_metadata: { completeness: { ingredientes_principales: 'complete' } } });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
  });

  await t.test('Declaración explícita de sección no aplica permite suficiencia', () => {
    const d = verifiedDish();
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.completeness.allSectionsSufficient, true);
  });

  await t.test('Contacto cruzado: unknown/not_assessed impide verified_absent', () => {
    const d = verifiedDish({ verification_metadata: { crossContamination: { status: 'unknown' }, ingredientAllergenAssessments: [{ term: 'pollo', allergen: 'cacahuate', state: 'verified_absent' }, { term: 'lechuga', allergen: 'cacahuate', state: 'verified_absent' }] } });
    const ev = evaluateAllergenForDish(d, 'cacahuate');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
  });

  await t.test('Alérgeno solicitado no mapeable => unknown conservador', () => {
    const d = verifiedDish();
    const ev = evaluateAllergenForDish(d, 'alergeno_desconocido_xyz');
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
  });

  await t.test('Negativa: falta de coincidencia/texto no demuestra ausencia sin verificación completa', () => {
    const d = { id: 'p3', ingredientes_principales: ['pollo'], complementos: [] };
    const ev = evaluateAllergenForDish(d, 'mani');
    assert.notEqual(ev.allergenState, ALLERGEN_STATES.VERIFIED_ABSENT);
    assert.equal(ev.allergenState, ALLERGEN_STATES.UNKNOWN);
  });
});
