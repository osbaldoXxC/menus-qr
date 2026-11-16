'use strict';
// Synthetic evidence and transaction doubles. No PostgreSQL or ML integration.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const domain = require('../../src/services/catalogEvidence');
const { computeRecipeVersion } = require('../../src/services/catalogVerification');
const { consolidateRestrictions } = require('../../src/services/restrictionConsolidation');
const { evaluateDishEligibility } = require('../../src/services/eligibilityService');
const { createCatalogEvidenceService, authorize } = require('../../src/services/catalogEvidenceService');

function fixture() {
  const restaurantId = randomUUID();
  const dish = { id: randomUUID(), restaurante_id: restaurantId, precio: '37.50', activo: true,
    evidencia_precio_revision: randomUUID(), evidencia_receta_revision: randomUUID(), nombre: 'Pollo',
    ...Object.fromEntries(domain.SECTIONS.map(s => [s, []])), ingredientes_principales: ['pollo', 'chile'] };
  const sections = Object.fromEntries(domain.SECTIONS.map(s => [s, 'complete']));
  const taxonomy = { grupo: 'cerdo', version: 1, revision: randomUUID(), estado: 'aprobada',
    aprobado_por: randomUUID(), aprobado_en: '2026-11-15', terms: ['cerdo', 'puerco', 'carne de cerdo'].map(t =>
      ({ termino_normalizado: t, relacion: 'sinonimo' })).concat([{ termino_normalizado: 'manteca de cerdo', relacion: 'derivado' }]) };
  const base = { restaurante_id: restaurantId, platillo_id: dish.id, actor_id: restaurantId,
    actor_tipo: 'RESTAURANTE', confirmado_en: '2026-11-15', procedencia: 'Revision de receta' };
  const absence = { ...base, grupo: 'cerdo', taxonomia_version: 1, taxonomia_revision: taxonomy.revision,
    receta_revision: dish.evidencia_receta_revision, receta_version: computeRecipeVersion(dish), secciones: sections };
  const price = { ...base, moneda: 'MXN', precio_confirmado: '37.50', version_precio: dish.evidencia_precio_revision };
  domain.attachEvidence(dish, { prices: [price], absences: [absence], taxonomy: [taxonomy] });
  return { dish, sections, taxonomy, absence, price, actor: { id: restaurantId, rol: 'RESTAURANTE' } };
}
const excluded = () => consolidateRestrictions({ structuredRestrictions: { excludedIngredients: ['puerco'] } });

test('R3 MXN exact price verified, cents equality and exceedance', () => {
  const { dish } = fixture();
  assert.equal(domain.currencyVerified(dish), true);
  for (const [budget, eligible] of [[37.50, true], [38, true], [37.49, false]]) {
    assert.equal(evaluateDishEligibility(dish, consolidateRestrictions({ structuredRestrictions: { budgetMax: budget } })).eligible, eligible);
  }
});
test('R3 omitted budget does not require monetary evidence or recipe', () => {
  assert.equal(evaluateDishEligibility({ id: 'x', precio: null }, consolidateRestrictions()).eligible, true);
});
test('R3 client verified flags cannot confer currency or absence', () => {
  const { dish } = fixture();
  const untrusted = { ...dish, verified: true, currencyVerified: true };
  assert.equal(domain.currencyVerified(untrusted), false);
  assert.equal(evaluateDishEligibility(untrusted, excluded()).eligible, false);
});
for (const mutation of ['price', 'priceRevision', 'revoked', 'tenant', 'actor']) {
  test(`R3 monetary evidence invalidated: ${mutation}`, () => {
    const { dish, price } = fixture();
    if (mutation === 'price') dish.precio = '37.51';
    if (mutation === 'priceRevision') dish.evidencia_precio_revision = randomUUID();
    if (mutation === 'revoked') price.revocado_en = '2026-11-16';
    if (mutation === 'tenant') price.restaurante_id = randomUUID();
    if (mutation === 'actor') price.actor_tipo = 'SUPER_ADMIN';
    assert.equal(domain.currencyVerified(dish), false);
  });
}
test('R3 reviewed pork absence supports structured synonym without cross-contamination claim', () => {
  const { dish } = fixture();
  assert.equal(evaluateDishEligibility(dish, excluded()).eligible, true);
  assert.equal(dish.contacto_cruzado, undefined);
});
test('R3 text-only spicy no pork corroborated from source, no monetary requirement', () => {
  const { dish, price } = fixture();
  price.revocado_en = '2026-11-16';
  const result = consolidateRestrictions({ mlExtraction: { excludedIngredients: [{ value: 'puerco',
    sourceText: 'Quiero algo picoso, pero que no tenga puerco' }] } });
  assert.equal(evaluateDishEligibility(dish, result).eligible, true);
});
test('R4 single text supports explicit spicy without pork and budget together', () => {
  const { dish } = fixture();
  const text = 'Quiero algo picoso sin puerco, y tengo 100 pesos';
  const c = consolidateRestrictions({ mlExtraction: {
    excludedIngredients: [{ value: 'puerco', sourceText: text }],
    budget: { amount: 100, currency: 'MXN', ambiguous: false, perPerson: null, sourceText: text }
  } });
  const result = evaluateDishEligibility(dish, c);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.evaluations.map(x => x.category).sort(), ['budget', 'exclusion']);
  dish.precio = '101.00';
  assert.equal(evaluateDishEligibility(dish, c).eligible, false);
});
for (const text of ['No quiero algo sin puerco', 'Quiero algo con puerco', 'Quizá sin puerco', 'Sin puerco o sin pollo',
  'Quiero algo sin puerco, pero con cerdo', 'Sin puerco, excepto manteca de cerdo']) {
  test(`R3 uncorroborated or ambiguous text stays closed: ${text}`, () => {
    const { dish } = fixture();
    const c = consolidateRestrictions({ mlExtraction: { excludedIngredients: [{ value: 'puerco', sourceText: text }] } });
    assert.equal(evaluateDishEligibility(dish, c).eligible, false);
  });
}
for (const mutation of ['pork', 'derivative', 'incomplete', 'revoked', 'recipe', 'revision', 'taxonomy', 'ambiguous', 'relational']) {
  test(`R3 absence rejects ${mutation}`, () => {
    const { dish, absence, taxonomy } = fixture();
    if (mutation === 'pork') dish.ingredientes_principales.push('carne de cerdo');
    if (mutation === 'derivative') dish.condimentos.push('manteca de cerdo');
    if (mutation === 'incomplete') delete absence.secciones.salsas;
    if (mutation === 'revoked') absence.revocado_en = '2026-11-16';
    if (mutation === 'recipe') dish.salsas.push('salsa nueva');
    if (mutation === 'revision') dish.evidencia_receta_revision = randomUUID();
    if (mutation === 'taxonomy') taxonomy.revision = randomUUID();
    if (mutation === 'ambiguous') domain.getEvidence(dish).taxonomy.push({ ...taxonomy, version: 2 });
    if (mutation === 'relational') dish.has_relational_recipe = true;
    assert.equal(evaluateDishEligibility(dish, excluded()).eligible, false);
  });
}
test('R3 contradictions and ambiguous animal origins cannot be confirmed', () => {
  const { dish, sections, taxonomy } = fixture();
  dish.ingredientes_principales = ['pollo', 'manteca de cerdo'];
  assert.equal(domain.recipeAssessment(dish, sections, taxonomy).state, 'incompatible');
  dish.ingredientes_principales = ['pollo', 'manteca'];
  assert.equal(domain.recipeAssessment(dish, sections, taxonomy).state, 'desconocido');
  dish.ingredientes_principales = ['pollo', 'chorizo casero'];
  assert.equal(domain.recipeAssessment(dish, sections, taxonomy).state, 'desconocido');
  dish.ingredientes_principales = ['pollo', 'salsa verde'];
  assert.equal(domain.recipeAssessment(dish, sections, taxonomy).state, 'desconocido');
  dish.ingredientes_principales = ['pollo', { name: 'salsa verde', subIngredients: ['chile', 'puerco'] }];
  assert.equal(domain.recipeAssessment(dish, sections, taxonomy).state, 'desconocido');
  dish.ingredientes_principales = ['pollo', { name: 'salsa verde', isCompound: true, compoundResolved: true, subIngredients: ['chile', 'puerco'] }];
  assert.equal(domain.recipeAssessment(dish, sections, taxonomy).state, 'incompatible');
});
test('R3 owner scope and superadmin delegation prohibited', () => {
  const { actor } = fixture();
  assert.doesNotThrow(() => authorize(actor, actor.id));
  assert.throws(() => authorize(actor, randomUUID()), { code: 'EVIDENCE_FORBIDDEN' });
  assert.throws(() => authorize({ ...actor, rol: 'SUPER_ADMIN' }, actor.id), { code: 'EVIDENCE_FORBIDDEN' });
});

function fakeDatabase(f, { foreign = false, auditFails = false, revoked = false } = {}) {
  const calls = [];
  const client = { release() { calls.push('RELEASE'); }, async query(sql) {
    calls.push(sql);
    if (sql.startsWith('SELECT id, rol')) return { rows: [f.actor] };
    if (sql.startsWith('SELECT * FROM platillos')) return { rows: foreign ? [] : [f.dish] };
    if (sql.includes('INSERT INTO confirmacion_moneda')) return { rows: [{ id: randomUUID() }] };
    if (sql.includes('INSERT INTO platillo_ausencia_confirmada')) return { rows: [{ id: randomUUID() }] };
    if (sql.startsWith('UPDATE confirmacion_moneda_restaurante') || sql.startsWith('UPDATE platillo_ausencia_confirmada')) {
      return { rows: foreign || revoked ? [] : [{ id: randomUUID() }] };
    }
    if (sql.startsWith('SELECT p.*')) return { rows: [{ ...f.dish, evidence_prices: [f.price],
      evidence_absences: [f.absence], evidence_taxonomy: [f.taxonomy] }] };
    if (sql.includes('INSERT INTO catalogo_evidencia_auditoria') && auditFails) throw Error('audit failed');
    return { rows: [] };
  } };
  return { database: { pool: { connect: async () => client } }, calls };
}
function priceInput(f) {
  return { currency: 'MXN', source: 'Revision del propietario', catalogFingerprint: domain.catalogFingerprint([f.dish]),
    dishes: [{ id: f.dish.id, price: f.dish.precio, priceRevision: f.dish.evidencia_precio_revision }] };
}
test('R3 currency confirmation atomic with audit, transaction double', async () => {
  const f = fixture(); const { database, calls } = fakeDatabase(f);
  await createCatalogEvidenceService(database).confirmCurrency(f.actor, f.actor.id, priceInput(f));
  assert.ok(calls.some(s => s.includes('confirmacion_precio_platillo')));
  assert.ok(calls.some(s => s.includes('catalogo_evidencia_auditoria')));
  assert.deepEqual(calls.slice(-2), ['COMMIT', 'RELEASE']);
});
test('R3 stale concurrent price rejected before insertion, transaction double', async () => {
  const f = fixture(); const input = priceInput(f); f.dish.evidencia_precio_revision = randomUUID();
  const { database, calls } = fakeDatabase(f);
  await assert.rejects(createCatalogEvidenceService(database).confirmCurrency(f.actor, f.actor.id, input), { code: 'CATALOG_CHANGED' });
  assert.equal(calls.some(s => s.includes('INSERT')), false);
  assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'RELEASE']);
});
test('R3 foreign dish rejected; audit failure rolls back; no arbitrary verification field', async () => {
  const f = fixture();
  const foreign = fakeDatabase(f, { foreign: true });
  await assert.rejects(createCatalogEvidenceService(foreign.database).confirmCurrency(f.actor, f.actor.id, priceInput(f)), { code: 'DISH_NOT_FOUND' });
  const audit = fakeDatabase(f, { auditFails: true });
  await assert.rejects(createCatalogEvidenceService(audit.database).confirmCurrency(f.actor, f.actor.id, priceInput(f)), /audit failed/);
  assert.deepEqual(audit.calls.slice(-2), ['ROLLBACK', 'RELEASE']);
  await assert.rejects(createCatalogEvidenceService(audit.database).confirmCurrency(f.actor, f.actor.id, { ...priceInput(f), verified: true }), { code: 'INVALID_EVIDENCE_REQUEST' });
});

const absenceInput = f => ({ source: 'Ficha revisada', recipeVersion: computeRecipeVersion(f.dish),
  recipeRevision: f.dish.evidencia_receta_revision, group: 'cerdo', taxonomyVersion: f.taxonomy.version,
  taxonomyRevision: f.taxonomy.revision, sections: f.sections });
test('R3 absence service confirms complete specific recipe with audit (transaction double)', async () => {
  const f = fixture(); const { database, calls } = fakeDatabase(f);
  await createCatalogEvidenceService(database).confirmAbsence(f.actor, f.actor.id, f.dish.id, absenceInput(f));
  assert.ok(calls.some(c => c.includes('exclusion_grupo_version') && c.includes('FOR SHARE')));
  assert.ok(calls.some(c => c.startsWith('INSERT INTO platillo_ausencia_confirmada')));
  assert.deepEqual(calls.slice(-2), ['COMMIT', 'RELEASE']);
});
test('R3 absence service rejects changed recipe and taxonomy; never inserts', async () => {
  for (const change of ['recipe', 'taxonomy']) {
    const f = fixture(), input = absenceInput(f);
    if (change === 'recipe') f.dish.evidencia_receta_revision = randomUUID();
    else f.taxonomy.estado = 'retirada';
    const { database, calls } = fakeDatabase(f);
    await assert.rejects(createCatalogEvidenceService(database).confirmAbsence(f.actor, f.actor.id, f.dish.id, input),
      { code: change === 'recipe' ? 'RECIPE_CHANGED' : 'TAXONOMY_CHANGED_OR_UNKNOWN' });
    assert.equal(calls.some(c => c.includes('INSERT')), false);
  }
});
test('R3 aligned structured and ML exclusion uses evidence, global ambiguity remains closed', () => {
  const { dish } = fixture();
  for (const ambiguous of [false, true]) {
    const c = consolidateRestrictions({ structuredRestrictions: { excludedIngredients: ['puerco'] },
      mlExtraction: { excludedIngredients: ['puerco'], ambiguous } });
    assert.equal(evaluateDishEligibility(dish, c).eligible, !ambiguous);
  }
});

test('R3 explicit textual budget corroborates ML amount; ambiguous text adds no price filter', () => {
  const { dish } = fixture();
  const proposal = { amount: 37, currency: 'MXN', ambiguous: false, perPerson: null };
  const c = consolidateRestrictions({ mlExtraction: { budget: { ...proposal, sourceText: 'Tengo 37 pesos y quiero tacos' } } });
  assert.equal(c.consolidatedRestrictions[0].origin, 'text_corroborated');
  assert.equal(evaluateDishEligibility(dish, c).eligible, false);
  for (const sourceText of ['Quiero tacos de máximo 37 pesos', 'Tengo 37 pesos para comer']) {
    const result = consolidateRestrictions({ mlExtraction: { budget: { ...proposal, sourceText } } });
    assert.equal(result.consolidatedRestrictions[0].value, 37);
    assert.equal(evaluateDishEligibility(dish, result).eligible, false);
  }
  for (const sourceText of ['Quiero algo dulce como pan, pero solo tengo 37 pesos', 'Quiero algo dulce y solo tengo 37 pesos']) {
    const result = consolidateRestrictions({ mlExtraction: { budget: { ...proposal, sourceText } } });
    assert.equal(result.consolidatedRestrictions[0].value, 37);
    assert.equal(evaluateDishEligibility(dish, result).eligible, false);
  }
  for (const sourceText of ['Tengo entre 37 y 50 pesos', 'Tengo 37 dólares', 'No tengo 37 pesos', 'Tengo 37 pesos por persona']) {
    const result = consolidateRestrictions({ mlExtraction: { budget: { ...proposal, sourceText } } });
    assert.equal(result.consolidatedRestrictions.length, 0);
  }
  const explicit = consolidateRestrictions({ structuredRestrictions: { budgetMax: 40 },
    mlExtraction: { budget: { ...proposal, sourceText: 'Tengo 37 pesos y quiero tacos' } } });
  assert.equal(explicit.consolidatedRestrictions.length, 1);
  assert.equal(explicit.consolidatedRestrictions[0].value, 40);
});

for (const kind of ['currency', 'absence']) {
  test(`R3 ${kind} revocation scoped and audited atomically (transaction double)`, async () => {
    const f = fixture(); const { database, calls } = fakeDatabase(f); const id = randomUUID();
    const result = await createCatalogEvidenceService(database).revoke(f.actor, f.actor.id, kind, id, { reason: 'Revisión posterior' });
    assert.deepEqual(result, { id, revoked: true });
    assert.ok(calls.some(c => c.startsWith('UPDATE ') && c.includes('restaurante_id = $1') && c.includes('revocado_en IS NULL')));
    assert.ok(calls.some(c => c.includes('catalogo_evidencia_auditoria')));
    assert.deepEqual(calls.slice(-2), ['COMMIT', 'RELEASE']);
  });
  test(`R3 ${kind} foreign or revoked evidence cannot be revoked (transaction double)`, async () => {
    for (const options of [{ foreign: true }, { revoked: true }]) {
      const f = fixture(); const { database, calls } = fakeDatabase(f, options);
      await assert.rejects(createCatalogEvidenceService(database).revoke(f.actor, f.actor.id, kind, randomUUID(), { reason: 'motivo' }), { code: 'ACTIVE_EVIDENCE_NOT_FOUND' });
      assert.equal(calls.some(c => c.includes('INSERT INTO catalogo_evidencia_auditoria')), false);
      assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'RELEASE']);
    }
  });
}

test('R3 inspect returns scoped, currently assessed evidence (transaction double)', async () => {
  const f = fixture(); const { database } = fakeDatabase(f);
  const result = await createCatalogEvidenceService(database).inspect(f.actor, f.actor.id, f.dish.id);
  assert.equal(result.currencyState, 'confirmed');
  assert.equal(result.exclusions[0].state, 'compatible_segun_datos');
  assert.equal(result.recipeVersion, computeRecipeVersion(f.dish));
});
