'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRecommendationRequest } = require('../../src/validators/recommendationRequest');
const { consolidateRestrictions } = require('../../src/services/restrictionConsolidation');
const { evaluateBudgetPrice, evaluateEligibility, buildSafeFallbackRecommendations } = require('../../src/services/eligibilityService');
const normalize = (restrictions) => normalizeRecommendationRequest({ restrictions });
test('DEC-002 valida valores, divisa y modalidad sin coercion', () => {
  assert.equal(normalize({}).ok, true);
  assert.equal(normalize({ budgetMax: 10.25 }).canonical.restrictions.budgetCurrency, 'MXN');
  assert.equal(normalize({ budgetMax: 100000, budgetCurrency: ' mxn ', budgetPerPerson: false }).ok, true);
  assert.equal(normalize({ budgetMax: null, budgetCurrency: null, budgetPerPerson: null }).ok, true);
  for (const value of [0, -1, 100000.01, 1.001, NaN, Infinity, -Infinity, '10', {}, true]) assert.equal(normalize({ budgetMax: value }).ok, false, String(value));
  for (const value of ['USD', '', 7, {}, true]) assert.equal(normalize({ budgetCurrency: value }).ok, false, String(value));
  for (const value of [true, 'false', 0, {}]) assert.equal(normalize({ budgetPerPerson: value }).ok, false, String(value));
});
test('DEC-002 comparacion exacta requiere evidencia interna de MXN', () => {
  for (const [price, expected] of [['9.99','compatible_segun_datos'], ['10.00','compatible_segun_datos'], ['10.01','incompatible']]) {
    assert.equal(evaluateBudgetPrice(price, 10, true).state, expected);
    assert.equal(evaluateBudgetPrice(price, 10, false).state, 'desconocido');
  }
  for (const price of [null, undefined, '', 'abc', '10x', -1, Infinity, '1.001']) assert.equal(evaluateBudgetPrice(price, 10, true).state, 'desconocido', String(price));
});
test('DEC-002 restriccion estructurada prevalece ante ML ambiguo, contrario o ausente', () => {
  for (const mlExtraction of [null, { budget: { amount: 1000, ambiguous: true } }, { items: [{ category: 'budget', value: 1000 }] }]) {
    const result = consolidateRestrictions({ structuredRestrictions: { budgetMax: 10, budgetCurrency: 'MXN' }, mlExtraction });
    const budgets = result.consolidatedRestrictions.filter(x => x.category === 'budget');
    assert.equal(budgets.length, 1); assert.equal(budgets[0].value, 10); assert.equal(budgets[0].origin, 'structured');
    const eligibility = evaluateEligibility([{ id: 'low', precio: '9.00' }, { id: 'high', precio: '11.00' }, { id: 'missing', precio: null }], result);
    assert.equal(eligibility.eligibleCount, 0); assert.ok(eligibility.evaluations.every(x => !x.eligible));
    assert.deepEqual(eligibility.evaluations.map(x => x.evaluations[0].reason), ['budget_currency_unverified', 'budget_currency_unverified', 'budget_price_invalid']);
    assert.deepEqual(buildSafeFallbackRecommendations(eligibility.eligible), []);
  }
});
test('DEC-002 ausencia de presupuesto no crea filtro monetario; inferencia ambigua no impone limite', () => {
  const result = consolidateRestrictions({ structuredRestrictions: {}, mlExtraction: { budget: { amount: 10, ambiguous: true } } });
  assert.equal(result.consolidatedRestrictions.length, 0);
  assert.equal(evaluateEligibility([{ id: 'd', precio: '1000.00' }], result).eligibleCount, 1);
});

test('presupuestos textuales concretos se corroboran sin convertir aproximaciones en máximos', () => {
  for (const [text, amount] of [['Traigo 80 varos',80],['No más de cien pesos',100],['No quiero gastar más de 100 varos',100]]) {
    const result = consolidateRestrictions({ structuredRestrictions:{}, mlExtraction:{ budget:{ amount, currency:'MXN', ambiguous:false, sourceText:text } } });
    const budget = result.consolidatedRestrictions.find(x=>x.category==='budget');
    assert.equal(budget?.value,amount,text); assert.equal(budget?.origin,'text_corroborated');
  }
  const approximate = consolidateRestrictions({ structuredRestrictions:{}, mlExtraction:{ budget:{ amount:100, currency:'MXN', ambiguous:true, sourceText:'Como unos 100 pesos' } } });
  assert.ok(!approximate.consolidatedRestrictions.some(x=>x.category==='budget'));
});
