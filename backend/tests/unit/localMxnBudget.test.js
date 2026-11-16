'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { consolidateRestrictions } = require('../../src/services/restrictionConsolidation');
const { evaluateEligibility, localMxnBudgetEnabled } = require('../../src/services/eligibilityService');

test('temporary MXN policy is opt-in and disabled outside development and tests', () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, LOCAL_MXN_BUDGET: process.env.LOCAL_MXN_BUDGET };
  try {
    const budget = consolidateRestrictions({ structuredRestrictions: { budgetMax: 40, budgetCurrency: 'MXN' } });
    const dishes = [{ id: 'under', precio: '35.00' }, { id: 'equal', precio: '40.00' },
      { id: 'over', precio: '40.01' }, { id: 'missing', precio: null }];
    process.env.LOCAL_MXN_BUDGET = 'true';
    for (const environment of ['production', 'staging', '']) {
      process.env.NODE_ENV = environment;
      assert.equal(localMxnBudgetEnabled(), false);
      assert.equal(evaluateEligibility(dishes, budget).eligibleCount, 0);
    }
    process.env.NODE_ENV = 'development';
    process.env.LOCAL_MXN_BUDGET = 'false';
    assert.equal(evaluateEligibility(dishes, budget).eligibleCount, 0);
    process.env.LOCAL_MXN_BUDGET = 'true';
    const local = evaluateEligibility(dishes, budget);
    assert.deepEqual(local.eligible.map(d => d.id), ['under', 'equal']);
    assert.equal(local.evaluations[0].evaluations[0].evidence.source, 'local_development_policy');
    assert.equal(local.evaluations[2].evaluations[0].reason, 'budget_exceeded');
    assert.equal(local.evaluations[3].evaluations[0].reason, 'budget_price_invalid');
    const exclusion = consolidateRestrictions({ structuredRestrictions: { budgetMax: 40, budgetCurrency: 'MXN', excludedIngredients: ['leche'] } });
    assert.equal(evaluateEligibility([{ id: 'milk', precio: '35.00', ingredientes_principales: ['leche'] }], exclusion).eligibleCount, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
