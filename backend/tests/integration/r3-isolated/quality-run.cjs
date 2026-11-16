'use strict';
// stdin: the recorded 15-request JSON. stdout: real isolated responses and ML interpretations.
const fs = require('fs');
async function post(url, payload) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000) });
  return { http: r.status, data: await r.json() };
}
async function main() {
  const source = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  const backend = 'http://127.0.0.1:4013';
  const ml = 'http://ml:8003';
  const health = await fetch(`${backend}/health`);
  if (!health.ok) throw Error('Isolated backend unavailable');
  const output = [];
  for (const item of source.output) {
    const requestId = `quality-isolated-${item.number}`;
    const payload = { craving: { text: item.text, tags: [] }, restrictions: {}, options: { limit: 5, locale: 'es-MX', requestId } };
    const interpretation = await post(`${ml}/interpret`, { requestId, ...payload });
    const response = await post(`${backend}/api/public/menu/recommendations`, payload);
    output.push({ number: item.number, text: item.text, before: { status: item.body.status.code, recommendations: item.body.recommendations.map(r => ({ name: r.dish.nombre, spice: r.dish.nivel_picante })) }, interpretation, response });
  }
  console.log(JSON.stringify({ environment: 'r3_test_isolated', note: 'Datos distintos del entorno principal; comparación no equivalente para catálogo y evidencias.', output }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
