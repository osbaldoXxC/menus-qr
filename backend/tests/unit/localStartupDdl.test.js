'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('protected local startup skips both automatic schema writers', () => {
  const script = `
    const calls = [];
    require('pg').Pool.prototype.query = text => { calls.push(text); return Promise.resolve({ rows: [] }); };
    require('./src/config/db');
    require('./src/controllers/supportController');
    setImmediate(() => console.log(JSON.stringify(calls)));
  `;
  for (const [environment, disabled, expected] of [['development', 'true', false], ['development', 'false', true], ['production', 'true', true]]) {
    const child = spawnSync(process.execPath, ['-e', script], { cwd: require('node:path').resolve(__dirname, '../..'),
      env: { ...process.env, NODE_ENV: environment, DISABLE_STARTUP_DDL: disabled }, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    const calls = JSON.parse(child.stdout.trim().split('\n').pop());
    assert.equal(calls.some(q => /CREATE TABLE/i.test(q)), expected, environment + ' ' + disabled);
  }
});
