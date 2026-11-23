'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const entry = path.resolve(__dirname, '../src/services/recommendationContract.ts');
const output = esbuild.buildSync({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const compiled = new Module(entry, module);
compiled.filename = entry;
compiled._compile(output, entry);
const { decodeRecommendationResponse } = compiled.exports;

function validResponse() {
  return {
    requestId: 'test', status: { code: 'ok' }, safety: { disclaimer: 'Datos declarados' }, meta: {}, error: null,
    recommendations: [{ dish: { id: 'd1', name: 'Taco', price: 45 }, restaurant: { id: 'r1', name: 'Restaurante' },
      reasons: [{ text: 'Coincide' }], safety: { disclaimer: 'Datos declarados' } }]
  };
}

test('decodes a recommendation without inventing dish data', () => {
  const result = decodeRecommendationResponse(validResponse());
  assert.equal(result.recommendations[0].dish.nombre, 'Taco');
  assert.equal(result.recommendations[0].dish.precio, 45);
  assert.deepEqual(result.recommendations[0].reasons, ['Coincide']);
});

test('rejects incomplete recommendations and invalid reasons', () => {
  const missingDish = validResponse();
  delete missingDish.recommendations[0].dish.id;
  assert.throws(() => decodeRecommendationResponse(missingDish), /Recomendación incompleta/);
  const invalidReason = validResponse();
  invalidReason.recommendations[0].reasons[0].text = 5;
  assert.throws(() => decodeRecommendationResponse(invalidReason), /Razón inválida/);
});
