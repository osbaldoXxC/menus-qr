'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { primaryFoodFamilies, selectRelevantFood } = require('../../src/services/primaryFoodRelevance');
const dishes = [
  { id:'pizza', nombre:'Pizza de champiñones', ingredientes_principales:['queso','champiñón'] },
  { id:'shrimp', nombre:'Arroz del mar', ingredientes_principales:['camarón','arroz'] },
  { id:'chicken', nombre:'Pollo asado', ingredientes_principales:['pollo'] },
  { id:'negated', nombre:'Taco sin camarones', ingredientes_principales:['maíz'] }
];
test('explicit food uses documented singular/plural forms, not unrelated dishes or negated names', () => {
  for (const text of ['Quiero camarones', 'Quiero un camarón', 'Busco camarón', 'Quiero algo con camarones', 'Tengo ganas de comer camarones']) {
    assert.deepEqual(selectRelevantFood(dishes,text).dishes.map(d=>d.id), ['shrimp']);
  }
  assert.deepEqual(selectRelevantFood(dishes,'Quiero pollo').dishes.map(d=>d.id), ['chicken']);
  assert.deepEqual(selectRelevantFood(dishes,'Quiero puerco').families, ['cerdo']);
  assert.equal(selectRelevantFood([{nombre:'Quisquillas al ajillo',ingredientes_principales:[]}], 'Quiero camarones').dishes.length,1);
});
test('alternatives are preserved and subjective or negated intent is not guessed', () => {
  assert.deepEqual(primaryFoodFamilies('Quiero pollo o camarones'), ['pollo','camaron']);
  assert.deepEqual(selectRelevantFood(dishes,'Quiero pollo o camarones').dishes.map(d=>d.id), ['shrimp','chicken']);
  for (const text of ['Quiero algo picoso', 'No quiero pollo', 'Quiero pollo o tofu']) {
    assert.equal(selectRelevantFood(dishes,text).constrained,false);
  }
});
test('no match is distinct from unknown intent; description never invents ingredients', () => {
  const none = selectRelevantFood([{nombre:'Pizza',descripcion:'No contiene camarones',ingredientes_principales:['queso']}], 'Quiero camarones');
  assert.equal(none.constrained,true); assert.deepEqual(none.dishes,[]);
  assert.equal(selectRelevantFood(dishes,'Quiero una sorpresa').dishes.length,dishes.length);
  assert.deepEqual(selectRelevantFood([{nombre:'Pizza con camarones',ingredientes_principales:['queso','camarón']}, dishes[0]], 'Quiero pizza con camarones').dishes.map(d=>d.nombre), ['Pizza con camarones']);
  assert.deepEqual(selectRelevantFood([{nombre:'Pizza sin camarones',ingredientes_principales:['camarón']}], 'Quiero camarones').dishes, []);
  assert.deepEqual(selectRelevantFood([{nombre:'Sopa sabor camarón',ingredientes_principales:['agua']}], 'Quiero camarones').dishes, []);
});

test('Mexican diminutives are interpreted as requests, never as invented catalog ingredients', () => {
  const shrimp = selectRelevantFood(dishes,'Quiero unos camaronsitos');
  assert.deepEqual(shrimp.dishes.map(d=>d.id),['shrimp']);
  assert.deepEqual(selectRelevantFood([{nombre:'Platillo',ingredientes_principales:['camaronsitos']}], 'Quiero camarón').dishes,[]);
  assert.deepEqual(selectRelevantFood(dishes,'Quiero un pollito').dishes.map(d=>d.id),['chicken']);
  assert.deepEqual(selectRelevantFood(dishes,'Un pollito').dishes.map(d=>d.id),['chicken']);
  assert.equal(selectRelevantFood(dishes,'Quiero una tortita').constrained,false);
  assert.deepEqual(primaryFoodFamilies('Quiero langostino'),['langostino']);
  assert.deepEqual(selectRelevantFood(dishes,'Quiero langostino').dishes,[]);
});
