const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidateRestrictions,
  applyCompatibilityEvidence,
  STATES,
  ORIGINS
} = require('../../src/services/restrictionConsolidation');

function byCat(list, category) {
  return list.filter((r) => r.category === category);
}

test('B1-T03 Consolidación de restricciones', async (t) => {
  await t.test('T01: restricción estructurada sin extracción ML se conserva', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t01',
      structuredRestrictions: { diet: 'vegan', allergies: ['gluten'] },
      mlExtraction: null
    });
    assert.equal(res.requestId, 'req_t01');
    assert.equal(byCat(res.consolidatedRestrictions, 'diet').length, 1);
    assert.equal(byCat(res.consolidatedRestrictions, 'allergy').length, 1);
    const diet = byCat(res.consolidatedRestrictions, 'diet')[0];
    assert.equal(diet.origin, ORIGINS.STRUCTURED);
    assert.equal(diet.state, STATES.DESCONOCIDO);
    assert.ok(res.issues.some((i) => i.code === 'ml_extraction_absent'));
    assert.ok(res.trace.extractionAvailability === 'absent');
  });

  await t.test('T02: restricción estructurada y extracción coincidentes se fusionan sin perder origen', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t02',
      structuredRestrictions: { allergies: ['mani'] },
      mlExtraction: { allergies: ['mani'] }
    });
    const mani = res.consolidatedRestrictions.filter((r) => r.normalizedValue === 'mani');
    assert.ok(mani.length >= 2, 'debe conservar procedencia estructurada y extraída');
    assert.ok(mani.some((r) => r.origin === ORIGINS.STRUCTURED));
    assert.ok(mani.some((r) => r.origin === ORIGINS.ML_EXTRACTION));
    // sin relajación automática por ausencia de evidencia verificada
    assert.ok(mani.every((r) => r.state !== STATES.COMPATIBLE_SEGUN_DATOS || r.reason !== 'auto'));
  });

  await t.test('T03: extracción ML contradice restricción explícita -> prevalece protección y conflicto', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t03',
      structuredRestrictions: { diet: 'vegan' },
      mlExtraction: { diet: 'none' }
    });
    const diet = byCat(res.consolidatedRestrictions, 'diet').find((r) => r.origin === ORIGINS.STRUCTURED);
    assert.ok(diet);
    assert.equal(diet.normalizedValue, 'vegan');
    assert.equal(diet.state, STATES.DESCONOCIDO);
    assert.ok(diet.conflicts.length >= 1 || diet.reason.includes('contradiction'));
    assert.ok(res.issues.some((i) => i.code === 'contradiction_detected'));
    assert.ok(res.trace.conflictCount >= 1);
  });

  await t.test('T04: extracción ML omite restricción estructurada -> no desaparece', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t04',
      structuredRestrictions: { allergies: ['cacahuate'] },
      mlExtraction: { allergies: [] }
    });
    const allergies = byCat(res.consolidatedRestrictions, 'allergy');
    assert.ok(allergies.some((r) => r.normalizedValue === 'cacahuate' && r.origin === ORIGINS.STRUCTURED));
    assert.ok(res.issues.some((i) => i.code === 'possible_ml_omission'));
  });

  await t.test('T05: extracción ambigua -> estado desconocido', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t05',
      structuredRestrictions: {},
      mlExtraction: { allergies: [{ value: 'nueces', ambiguous: true }] }
    });
    const item = byCat(res.consolidatedRestrictions, 'allergy')[0];
    assert.ok(item);
    assert.equal(item.state, STATES.DESCONOCIDO);
    assert.ok(item.reason.includes('ambiguous'));
  });

  await t.test('T06: extracción ausente -> conservador, nunca compatibilidad automática', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t06',
      structuredRestrictions: { diet: 'vegetarian' },
      mlExtraction: undefined
    });
    const diet = byCat(res.consolidatedRestrictions, 'diet')[0];
    assert.ok(diet);
    assert.notEqual(diet.state, STATES.COMPATIBLE_SEGUN_DATOS);
    assert.equal(res.summary.conservative, true);
  });

  await t.test('T07: datos insuficientes/no verificables -> estado desconocido', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t07',
      structuredRestrictions: {},
      mlExtraction: { diet: { value: 'vegan', verifiable: false } }
    });
    const diet = byCat(res.consolidatedRestrictions, 'diet')[0];
    assert.ok(diet);
    assert.equal(diet.state, STATES.DESCONOCIDO);
  });

  await t.test('T08: evidencia suficiente de incompatibilidad (aplicada determinísticamente)', () => {
    const base = consolidateRestrictions({
      requestId: 'req_t08',
      structuredRestrictions: { allergies: ['gluten'] },
      mlExtraction: null
    });
    const target = base.consolidatedRestrictions[0];
    const withEvidence = applyCompatibilityEvidence(base, {
      byId: { [target.id]: { state: STATES.INCOMPATIBLE, evidence: 'ingrediente_declarado', reason: 'alergeno_detectado' } }
    });
    assert.equal(withEvidence.consolidatedRestrictions[0].state, STATES.INCOMPATIBLE);
  });

  await t.test('T09: evidencia suficiente de compatibilidad (aplicada determinísticamente)', () => {
    const base = consolidateRestrictions({
      requestId: 'req_t09',
      structuredRestrictions: { allergies: ['gluten'] },
      mlExtraction: null
    });
    const target = base.consolidatedRestrictions[0];
    const withEvidence = applyCompatibilityEvidence(base, {
      byId: { [target.id]: { state: STATES.COMPATIBLE_SEGUN_DATOS, evidence: 'datos_completos_sin_match', reason: 'compatible_segun_datos' } }
    });
    assert.equal(withEvidence.consolidatedRestrictions[0].state, STATES.COMPATIBLE_SEGUN_DATOS);
  });

  await t.test('T10: restricciones duplicadas con diferentes orígenes conservan procedencia', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t10',
      structuredRestrictions: { allergies: ['soya'] },
      mlExtraction: { allergies: ['soya'] }
    });
    const origins = res.consolidatedRestrictions.filter((r) => r.normalizedValue === 'soya').map((r) => r.origin);
    assert.ok(origins.includes(ORIGINS.STRUCTURED));
    assert.ok(origins.includes(ORIGINS.ML_EXTRACTION));
  });

  await t.test('T11: contradicción no resoluble -> estado desconocido y conflicto trazable', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t11',
      structuredRestrictions: { diet: 'vegan' },
      mlExtraction: { diet: 'vegetarian' }
    });
    const diet = byCat(res.consolidatedRestrictions, 'diet').find((r) => r.origin === ORIGINS.STRUCTURED);
    assert.equal(diet.state, STATES.DESCONOCIDO);
    assert.ok((diet.conflicts && diet.conflicts.length > 0) || res.issues.some((i) => i.code === 'contradiction_detected'));
  });

  await t.test('T12: requestId proporcionado se conserva', () => {
    const res = consolidateRestrictions({
      requestId: 'req_custom_abc',
      structuredRestrictions: { diet: 'vegan' },
      mlExtraction: null
    });
    assert.equal(res.requestId, 'req_custom_abc');
    assert.ok(res.consolidatedRestrictions.every((r) => r.requestId === 'req_custom_abc'));
  });

  await t.test('T13: requestId ausente o inválido aplica comportamiento B1-T02 (generado) sin perder trazabilidad', () => {
    const res = consolidateRestrictions({
      requestId: '!!!invalid!!!',
      structuredRestrictions: { allergies: ['gluten'] },
      mlExtraction: null
    });
    assert.ok(typeof res.requestId === 'string' && res.requestId.startsWith('req_'));
    assert.ok(res.consolidatedRestrictions.every((r) => r.requestId === res.requestId));
  });

  await t.test('T14: múltiples restricciones simultáneas -> ninguna desaparece', () => {
    const res = consolidateRestrictions({
      requestId: 'req_t14',
      structuredRestrictions: { diet: 'vegan', allergies: ['gluten', 'mani'], excludedIngredients: ['cebolla'] },
      mlExtraction: null
    });
    const cats = res.consolidatedRestrictions.map((r) => `${r.category}:${r.normalizedValue}`);
    assert.ok(cats.includes('diet:vegan'));
    assert.ok(cats.includes('allergy:gluten'));
    assert.ok(cats.includes('allergy:mani'));
    assert.ok(cats.includes('exclusion:cebolla'));
    assert.equal(res.consolidatedRestrictions.length >= 4, true);
  });

  await t.test('Adicional: extracción no verificable (objeto error) es conservadora', () => {
    const res = consolidateRestrictions({
      requestId: 'req_extra_nv',
      structuredRestrictions: { diet: 'vegan' },
      mlExtraction: { error: 'timeout' }
    });
    assert.equal(res.trace.extractionAvailability, 'not_verifiable');
    assert.ok(res.consolidatedRestrictions.some((r) => r.category === 'diet'));
    assert.ok(res.issues.some((i) => i.code === 'ml_extraction_not_verifiable'));
  });
});
