'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const entry = path.resolve(__dirname, '../src/features/recommendations/searchFlow.ts');
const output = esbuild.buildSync({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const compiled = new Module(entry, module); compiled.filename = entry; compiled._compile(output, entry);
const { createSearchFlow } = compiled.exports;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (code, count = 0) => ({ requestId: 'req-test', status: { code }, recommendations: Array.from({ length: count }, () => ({ dish: { id: 'd' } })) });

test('minimum presentation holds fast responses, never truncates a slow request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred(); let calls = 0;
  const flow = createSearchFlow(() => { calls++; return calls === 1 ? Promise.resolve(response('ok', 1)) : pending.promise; }, () => {}, 1500);
  const fast = flow.search('pan'); await Promise.resolve();
  t.mock.timers.tick(1499); await Promise.resolve(); assert.equal(flow.getState().phase, 'loading');
  t.mock.timers.tick(1); await fast; assert.equal(flow.getState().phase, 'success');
  flow.edit(); const slow = flow.search('pollo');
  t.mock.timers.tick(2000); await Promise.resolve(); assert.equal(flow.getState().phase, 'loading');
  pending.resolve(response('ok', 1)); await slow; assert.equal(flow.getState().phase, 'success');
});

test('cancel and error do not wait on the presentation timer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred(); let calls = 0;
  const flow = createSearchFlow(() => ++calls === 1 ? pending.promise : Promise.reject(Error('offline')), () => {}, 1500);
  const first = flow.search('tacos'); flow.edit(); pending.resolve(response('ok', 1)); await first;
  assert.equal(flow.getState().phase, 'idle'); await flow.search('otra'); assert.equal(flow.getState().phase, 'error');
});

test('idle makes no request; blank input is rejected without calling API', async () => {
  let calls = 0; const flow = createSearchFlow(() => { calls++; }, () => {});
  assert.equal(flow.getState().phase, 'idle'); assert.equal(calls, 0);
  await flow.search('   '); assert.equal(flow.getState().phase, 'error'); assert.equal(calls, 0);
});
test('loading persists until API resolves; single click sends entire text once', async () => {
  const pending = deferred(); const messages = []; const states = [];
  const flow = createSearchFlow(message => { messages.push(message); return pending.promise; }, state => states.push(state.phase));
  const search = flow.search('Quiero algo picoso sin puerco');
  assert.equal(flow.getState().phase, 'loading'); await flow.search('duplicado');
  assert.deepEqual(messages, ['Quiero algo picoso sin puerco']); assert.deepEqual(states, ['loading']);
  pending.resolve(response('ok', 1)); await search;
  assert.deepEqual(states, ['loading', 'success']); assert.equal(flow.getState().response.requestId, 'req-test');
});
test('only a proper no_verified_results response presents the empty state', async () => {
  const flow = createSearchFlow(async () => response('no_verified_results'), () => {});
  await flow.search('quiero pan'); assert.equal(flow.getState().phase, 'no_verified_results');
  const invalid = createSearchFlow(async () => response('ok'), () => {});
  await invalid.search('quiero pan'); assert.equal(invalid.getState().phase, 'error');
  const contradictory = createSearchFlow(async () => response('no_verified_results', 1), () => {});
  await contradictory.search('quiero pan'); assert.equal(contradictory.getState().phase, 'error');
});
test('connection and HTTP errors remain errors and allow retry', async () => {
  let n = 0; const flow = createSearchFlow(async () => {
    n++; if (n === 1) throw Error('offline'); if (n === 2) throw { response: { status: 500 } }; return response('ok', 1);
  }, () => {});
  await flow.search('Quiero algo picoso'); assert.match(flow.getState().message, /conectar/);
  await flow.search('Quiero algo picoso'); assert.match(flow.getState().message, /servicio/);
  await flow.search('Quiero algo picoso'); assert.equal(flow.getState().phase, 'success');
});
test('editing during a request allows a new search and discards stale results and errors', async () => {
  const first = deferred(), second = deferred(); let count = 0;
  const flow = createSearchFlow(() => (++count === 1 ? first.promise : second.promise), () => {});
  const old = flow.search('Quiero algo picoso'); flow.edit();
  const next = flow.search('Quiero algo dulce como pan, pero tengo 100 pesos');
  first.resolve(response('no_verified_results')); await old;
  assert.equal(flow.getState().phase, 'loading');
  second.resolve(response('ok', 1)); await next;
  assert.equal(flow.getState().phase, 'success');
});
test('completion after disposal is ignored and no further calls are issued', async () => {
  const p = deferred(); let calls = 0; const states = [];
  const flow = createSearchFlow(() => { calls++; return p.promise; }, state => states.push(state.phase));
  const pending = flow.search('tacos'); flow.dispose(); p.resolve(response('ok', 1)); await pending;
  await flow.search('otra'); assert.deepEqual(states, ['loading']); assert.equal(calls, 1);
});
