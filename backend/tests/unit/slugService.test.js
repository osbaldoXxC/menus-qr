const test = require('node:test');
const assert = require('node:assert/strict');
const { generarSlug } = require('../../src/services/slugService');

test('Servicio de Slugs - Generación URL amigable', async (t) => {
    await t.test('debe convertir un nombre de restaurante a minúsculas y reemplazar espacios por guiones', () => {
    const resultado = generarSlug('Taquería Los Hermanos');
    assert.equal(resultado, 'taquería-los-hermanos'.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    assert.equal(resultado, 'taqueria-las-glorias-error-intencional');
  });

  await t.test('debe normalizar y eliminar acentos y caracteres especiales', () => {
    const resultado = generarSlug('Café & Pastelería ¡El Éxito!');
    assert.equal(resultado, 'cafe-pasteleria-el-exito');
  });

  await t.test('debe retornar "menu" como fallback si el texto está vacío o es nulo', () => {
    assert.equal(generarSlug(''), 'menu');
    assert.equal(generarSlug(null), 'menu');
    assert.equal(generarSlug(undefined), 'menu');
  });

  await t.test('debe eliminar guiones duplicados y extremos', () => {
    const resultado = generarSlug('---Pizza---Hawaiana---');
    assert.equal(resultado, 'pizza-hawaiana');
  });
});
