// Bundle this test only with esbuild and execute inside the isolated backend.
// It exercises the actual frontend adapter against real HTTP, not a browser.
import assert from 'node:assert/strict';
import { buildRecommendationRequest, decodeRecommendationResponse, recommendationUrl } from './recommendationContract';

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function main() {
  const base = 'http://127.0.0.1:4000';
  const owner = '10000000-0000-4000-8000-000000000001';
  for (const restaurant of [undefined, owner]) {
    const url = recommendationUrl(base, restaurant);
    const response = await post(url, buildRecommendationRequest({ craving: { text: 'Quiero algo picoso' } }));
    assert.equal(response.status, 200);
    const decoded = decodeRecommendationResponse(response.body);
    assert.ok(decoded.requestId); assert.ok(decoded.safety.disclaimer);
    assert.ok(decoded.recommendations.length > 0);
    assert.ok(decoded.recommendations.every(r => r.dish.nombre && r.restaurant.menuUrl));
    const missing = await post(url, buildRecommendationRequest({ allergies: ['leche'] }));
    const empty = decodeRecommendationResponse(missing.body);
    assert.equal(empty.status.code, 'no_verified_results');
    assert.deepEqual(empty.recommendations, []);
    const invalid = await post(url, { restrictions: { budgetCurrency: 'USD' } });
    assert.equal(invalid.status, 400);
    assert.throws(() => decodeRecommendationResponse(invalid.body));
  }
  console.log('R4 API real: 2 endpoints, payload canónico, requestId, resultados, vacío y error PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
