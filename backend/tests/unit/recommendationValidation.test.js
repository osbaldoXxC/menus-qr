const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRecommendationRequest,
  buildValidationErrorResponse
} = require('../../src/validators/recommendationRequest');

test('B1-T02 Validación de recomendaciones', async (t) => {
  await t.test('rechaza campos legacy fuera del contrato', () => {
    assert.equal(normalizeRecommendationRequest({ diet: 'vegetarian', allergies: ['gluten'], limit: 8 }).ok, false);
  });

  await t.test('acepta payload canónico válido', () => {
    const body = {
      craving: { text: 'algo ligero', tags: [] },
      restrictions: { diet: 'vegan', allergies: ['mani'], excludedIngredients: ['cebolla'] },
      options: { limit: 3, locale: 'es-MX', requestId: 'req_test_123' }
    };
    const result = normalizeRecommendationRequest(body);
    assert.equal(result.ok, true);
    assert.equal(result.limitApplied, 3);
    assert.equal(result.requestId, 'req_test_123');
    assert.equal(result.legacy.diet, 'vegan');
    assert.deepEqual(result.legacy.allergies, ['mani']);
  });

  await t.test('rechaza body no objeto', () => {
    const result = normalizeRecommendationRequest('invalido');
    assert.equal(result.ok, false);
    assert.ok(Array.isArray(result.details) && result.details.length > 0);
  });

  await t.test('rechaza limit fuera de rango', () => {
    const result = normalizeRecommendationRequest({ options: { limit: 11 } });
    assert.equal(result.ok, false);
    assert.ok(result.details.some(d => d.field === 'limit' || d.field.endsWith('.limit')));
  });

  await t.test('rechaza diet inválida', () => {
    const result = normalizeRecommendationRequest({ restrictions: { diet: 'keto' } });
    assert.equal(result.ok, false);
    assert.ok(result.details.some(d => d.field === 'diet' || d.field.endsWith('.diet')));
  });

  await t.test('rechaza locale inválido', () => {
    const result = normalizeRecommendationRequest({ options: { locale: '!!!' } });
    assert.equal(result.ok, false);
    assert.ok(result.details.some(d => d.field.includes('locale')));
  });

  await t.test('genera requestId cuando falta y normaliza limit por defecto', () => {
    const result = normalizeRecommendationRequest({});
    assert.equal(result.ok, true);
    assert.equal(result.limitApplied, 5);
    assert.ok(result.requestId.startsWith('req_'));
  });

  await t.test('construye respuesta uniforme de error de validación', () => {
    const resBody = buildValidationErrorResponse([{ field: 'limit', reason: 'must_be_between_1_and_10' }], 'req_x', 5);
    assert.equal(resBody.error.code, 'INVALID_REQUEST');
    assert.equal(resBody.status.code, 'invalid_request');
    assert.equal(resBody.meta.requestId, 'req_x');
    assert.deepEqual(resBody.recommendations, []);
    assert.equal(resBody.error.details[0].field, 'limit');
  });
});
