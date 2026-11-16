'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidateRestrictions,
  STATES,
  ORIGINS
} = require('../../src/services/restrictionConsolidation');

function byCat(list, category) {
  return list.filter((r) => r.category === category);
}

test('B1-T03 Consolidación - contrato esperado con extracción ML simulada (mock), no integración ML real', async (t) => {
  await t.test('Ausencia de datos de extracción (null/undefined) preserva restricciones explícitas y es conservador', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_absent',
      structuredRestrictions: { allergies: ['gluten'], diet: 'vegan' },
      mlExtraction: null
    });
    assert.equal(byCat(res.consolidatedRestrictions, 'allergy').length >= 1, true);
    assert.equal(byCat(res.consolidatedRestrictions, 'diet').length >= 1, true);
    assert.equal(res.trace.extractionAvailability, 'absent');
    assert.ok(res.consolidatedRestrictions.every((r) => r.state !== STATES.COMPATIBLE_SEGUN_DATOS));
  });

  await t.test('Ambigüedad en extracción simulada produce estado desconocido y no relaja', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_amb',
      structuredRestrictions: { allergies: ['mani'] },
      mlExtraction: { allergies: [{ value: 'mani', ambiguous: true }], ambiguous: true }
    });
    const items = byCat(res.consolidatedRestrictions, 'allergy');
    assert.ok(items.length >= 1);
    assert.ok(items.some((r) => r.state === STATES.DESCONOCIDO));
  });

  await t.test('Contradicción en extracción simulada preserva protección y registra conflicto', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_contra',
      structuredRestrictions: { diet: 'vegan' },
      mlExtraction: { diet: 'vegetarian' }
    });
    const diet = byCat(res.consolidatedRestrictions, 'diet').find((r) => r.origin === ORIGINS.STRUCTURED);
    assert.ok(diet);
    assert.equal(diet.normalizedValue, 'vegan');
    assert.equal(diet.state, STATES.DESCONOCIDO);
    assert.ok(res.issues.some((i) => i.code === 'contradiction_detected') || (diet.conflicts && diet.conflicts.length > 0));
  });

  await t.test('Restricciones explícitas estructuradas se mantienen aunque extracción simulada esté vacía', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_explicit',
      structuredRestrictions: { allergies: ['cacahuate'], excludedIngredients: ['cebolla'] },
      mlExtraction: { allergies: [], exclusions: [] }
    });
    assert.ok(res.consolidatedRestrictions.some((r) => r.normalizedValue === 'cacahuate' && r.origin === ORIGINS.STRUCTURED));
    assert.ok(res.consolidatedRestrictions.some((r) => r.normalizedValue === 'cebolla' && r.origin === ORIGINS.STRUCTURED));
  });

  await t.test('Omisión en extracción simulada no elimina restricción estructurada', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_omit',
      structuredRestrictions: { allergies: ['nuez'] },
      mlExtraction: { diet: 'none' }
    });
    assert.ok(res.consolidatedRestrictions.some((r) => r.category === 'allergy' && r.normalizedValue === 'nuez'));
    assert.ok(res.issues.some((i) => i.code === 'possible_ml_omission'));
  });

  await t.test('Información no verificable en extracción simulada es fail-closed (desconocido)', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_nv',
      structuredRestrictions: { allergies: ['huevo'] },
      mlExtraction: { allergies: [{ value: 'huevo', verifiable: false }], verifiable: false }
    });
    assert.ok(res.consolidatedRestrictions.every((r) => r.state !== STATES.COMPATIBLE_SEGUN_DATOS));
  });

  await t.test('Fallos de extracción simulados (error/status unavailable) se tratan como no verificables/conservadores', () => {
    const res = consolidateRestrictions({
      requestId: 'req_mock_fail',
      structuredRestrictions: { diet: 'vegetarian' },
      mlExtraction: { error: 'timeout', status: 'unavailable' }
    });
    assert.equal(res.trace.extractionAvailability, 'not_verifiable');
    const diet = byCat(res.consolidatedRestrictions, 'diet')[0];
    assert.ok(diet);
    assert.notEqual(diet.state, STATES.COMPATIBLE_SEGUN_DATOS);
  });

  await t.test('Comportamiento fail-closed: sin evidencia verificada nunca produce compatible automático', () => {
    const scenarios = [
      { structuredRestrictions: { allergies: ['soya'] }, mlExtraction: null },
      { structuredRestrictions: { allergies: ['soya'] }, mlExtraction: { allergies: [{ value: 'soya', ambiguous: true }] } },
      { structuredRestrictions: { allergies: ['soya'] }, mlExtraction: { error: 'bad_response' } }
    ];
    for (const s of scenarios) {
      const res = consolidateRestrictions({ requestId: 'req_failclosed', ...s });
      assert.ok(res.consolidatedRestrictions.every((r) => r.state !== STATES.COMPATIBLE_SEGUN_DATOS));
    }
  });
});
