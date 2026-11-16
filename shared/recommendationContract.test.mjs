import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendationRequest, recommendationUrl, decodeRecommendationResponse } from './recommendationContract.ts';
import { readFileSync } from 'node:fs';

test('R4 Docker build contexts contain the identical contract', () => {
  const source = readFileSync(new URL('./recommendationContract.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const portal of ['frontend-comensales', 'frontend-restaurantes']) {
    assert.equal(readFileSync(new URL(`../${portal}/src/services/recommendationContract.ts`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'), source);
  }
});

test('R4 text-only keeps budget absent and DEC-012 defaults', () => {
  const body = buildRecommendationRequest({ craving: { text: 'Quiero algo picoso, pero que no tenga puerco' } });
  assert.deepEqual(body.restrictions, {});
  assert.equal(body.craving.text, 'Quiero algo picoso, pero que no tenga puerco');
  assert.deepEqual(body.options, { limit: 5, locale: 'es-MX' });
});
test('R4 optional restrictions independent; canonical diet and MXN only with budget', () => {
  assert.deepEqual(buildRecommendationRequest({ allergies: ['huevo'] }).restrictions, { allergies: ['huevo'] });
  assert.deepEqual(buildRecommendationRequest({ excludedIngredients: ['cerdo'] }).restrictions, { excludedIngredients: ['cerdo'] });
  assert.deepEqual(buildRecommendationRequest({ diet: 'vegetariana' }).restrictions, { diet: 'vegetarian' });
  assert.deepEqual(buildRecommendationRequest({ budgetMax: 37.50 }).restrictions, { budgetMax: 37.50, budgetCurrency: 'MXN' });
});
test('R4 invalid budget or unsupported diet cannot silently become unrestricted', () => {
  for (const budgetMax of [NaN, 0, -1, Infinity, 100000.01, 1.001]) assert.throws(() => buildRecommendationRequest({ budgetMax }));
  assert.throws(() => buildRecommendationRequest({ diet: 'keto' }));
});
test('R4 both canonical URLs with or without api suffix; restaurant identifier escaped', () => {
  for (const base of ['http://localhost:4000', 'http://localhost:4000/api', 'http://localhost:4000/api/']) {
    assert.equal(recommendationUrl(base), 'http://localhost:4000/api/public/menu/recommendations');
    assert.equal(recommendationUrl(base, 'a/b'), 'http://localhost:4000/api/public/menu/a%2Fb/recommendations');
  }
});
const envelope = () => ({ requestId: 'synthetic', recommendations: [], safety: { overall: 'sin_resultados_verificables', disclaimer: 'Información declarada, sin garantía de trazas.' },
  status: { code: 'no_verified_results' }, error: null, meta: { fallback: false, mlUsed: true, returned: 0, limitApplied: 5 } });
test('R4 empty and errors never generate local recommendations', () => {
  assert.deepEqual(decodeRecommendationResponse(envelope()).recommendations, []);
  assert.throws(() => decodeRecommendationResponse({ ...envelope(), error: { code: 'INVALID_REQUEST', message: 'Datos inválidos' } }), /Datos inválidos/);
  assert.throws(() => decodeRecommendationResponse({ recommendations: [] }));
});
test('R4 canonical dish, reasons and safety survive; no invented price/ingredients/score', () => {
  const value = envelope();
  value.recommendations = [{ dish: { id: 'd1', name: 'Pollo' }, restaurant: { id: 'r1', name: 'Restaurante' },
    reasons: [{ type: 'ranking', text: 'Seleccionado según datos del menú.' }], safety: { overall: 'compatible_segun_datos', disclaimer: 'Información declarada.' },
    match: { score: 0.9, matchPercentage: 90 } }];
  const [item] = decodeRecommendationResponse(value).recommendations;
  assert.equal(item.dish.nombre, 'Pollo'); assert.equal(item.dish.precio, undefined); assert.equal(item.dish.ingredientes_principales, undefined);
  assert.equal(item.matchPercentage, undefined); assert.equal(item.safety.disclaimer, 'Información declarada.');
  assert.deepEqual(item.reasons, ['Seleccionado según datos del menú.']);
});
