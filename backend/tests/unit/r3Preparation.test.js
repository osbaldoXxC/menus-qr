'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { consolidateRestrictions } = require('../../src/services/restrictionConsolidation');
const { evaluateDishEligibility, evaluateBudgetPrice } = require('../../src/services/eligibilityService');
const { computeRecipeVersion, evaluateVerificationStatus, evaluateCompleteness, evaluateAllergenForDish } = require('../../src/services/catalogVerification');

function verifiedSyntheticDish() {
  const dish = { id: 'synthetic', ingredientes_principales: ['pollo'], complementos: [], precio: '10.00' };
  dish.verification_metadata = {
    verificationState: 'verified_approved', verifiedBy: 'synthetic-test', verifiedAt: '2026-11-15T00:00:00Z',
    verificationSource: 'synthetic-test', crossContamination: { status: 'verified_controlled' },
    completeness: { ingredientes_principales: 'complete', ingredientes_secundarios: 'not_applicable_declared', complementos: 'not_applicable_declared', salsas: 'not_applicable_declared', aderezos: 'not_applicable_declared', condimentos: 'not_applicable_declared', ingredientes_compuestos: 'not_applicable_declared', sustituciones_permitidas: 'not_applicable_declared', modificadores_opcionales: 'not_applicable_declared', contacto_cruzado: 'complete' },
    ingredientAllergenAssessments: [{ term: 'pollo', allergen: 'cacahuate', state: 'verified_absent', source: 'synthetic-test' }]
  };
  dish.verification_metadata.verifiedRecipeVersion = computeRecipeVersion(dish);
  return dish;
}

test('preparacion R3: origen y texto de exclusion inferida se conservan sin aprobarse', () => {
  for (const [text, term] of [['Quiero algo picoso sin puerco', 'puerco'], ['Quiero pollo sin cebolla', 'cebolla']]) {
    const result = consolidateRestrictions({ mlExtraction: { excludedIngredients: [{ value: term, sourceText: text }] } });
    const restriction = result.consolidatedRestrictions[0];
    assert.equal(restriction.normalizedValue, term); assert.equal(restriction.origin, 'ml_extraction');
    assert.equal(restriction.raw.sourceText, text); assert.equal(restriction.state, 'desconocido');
    assert.equal(evaluateDishEligibility(verifiedSyntheticDish(), result).eligible, false);
  }
});

test('preparacion R3: evidencia sintetica de alergeno es separada de ausencia de cerdo', () => {
  const dish = verifiedSyntheticDish();
  assert.equal(evaluateVerificationStatus(dish).verifiedApproved, true);
  assert.equal(evaluateCompleteness(dish).allSectionsSufficient, true);
  assert.equal(evaluateAllergenForDish(dish, 'cacahuate').allergenState, 'verified_absent');
  const pork = consolidateRestrictions({ structuredRestrictions: { excludedIngredients: ['puerco'] } });
  assert.equal(evaluateDishEligibility(dish, pork).eligible, false);
  dish.ingredientes_principales.push('cambio');
  assert.equal(evaluateVerificationStatus(dish).verifiedApproved, false);
});

test('preparacion R3: presupuesto opcional y comparacion sintetica sin evidencia real', () => {
  const noBudget = consolidateRestrictions({ structuredRestrictions: {} });
  assert.equal(evaluateDishEligibility({ id: 'd', precio: null }, noBudget).eligible, true);
  assert.equal(evaluateBudgetPrice('10.00', 10, true).state, 'compatible_segun_datos');
  assert.equal(evaluateBudgetPrice('10.01', 10, true).state, 'incompatible');
  assert.equal(evaluateBudgetPrice('9.99', 10, false).state, 'desconocido');
});
