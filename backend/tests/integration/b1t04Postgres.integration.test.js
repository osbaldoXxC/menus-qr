'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const db = require('../../src/config/db');
const { getDishes, createDish, updateDish } = require('../../src/controllers/menuController');
const { evaluateDishEligibility } = require('../../src/services/eligibilityService');
const { buildConservativeVerificationMetadata } = require('../../src/services/catalogVerification');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
function makeReq({ user, body = {}, params = {}, query = {}, file = null }) {
  return { user, body, params, query, file, protocol: 'http', get: () => 'localhost:4000' };
}

async function withFixture(fn) {
  const client = await db.pool.connect();
  let restaurantId, categoriaId;
  const dishIds = [];
  try {
    const r = await client.query(
      `INSERT INTO restaurantes (nombre_negocio, email, password_hash, email_verificado, suscripcion_activa, estado)
       VALUES ($1,$2,$3,true,true,'aprobado') RETURNING id`,
      [`B1T04 INT ${randomUUID()}`, `b1t04int_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`, 'hash']
    );
    restaurantId = r.rows[0].id;
    const c = await client.query(
      `INSERT INTO categorias_restaurante (restaurante_id, nombre, orden) VALUES ($1,$2,1) RETURNING id`,
      [restaurantId, 'Cat']
    );
    categoriaId = c.rows[0].id;
    const user = { id: restaurantId, role: 'RESTAURANTE', rol: 'RESTAURANTE' };
    await fn({ client, user, restaurantId, categoriaId, dishIds });
  } finally {
    try {
      for (const id of dishIds) {
        if (id) await client.query('DELETE FROM platillos WHERE id = $1', [id]);
      }
      if (categoriaId) await client.query('DELETE FROM categorias_restaurante WHERE id = $1', [categoriaId]);
      if (restaurantId) await client.query('DELETE FROM restaurantes WHERE id = $1', [restaurantId]);
    } finally {
      client.release();
    }
  }
}

test('PostgreSQL integration: create/persist/retrieve JSONB metadata and states', async () => {
  await withFixture(async ({ client, user, categoriaId, dishIds }) => {
    const req = makeReq({ user, body: {
      nombre: 'Platillo integración', descripcion: 'd', precio: '100', categoria_id: categoriaId,
      ingredientes_principales: ['pollo'], ingredientes_secundarios: ['arroz'], salsas: [], aderezos: [], condimentos: ['sal'],
      ingredientes_compuestos: [], sustituciones_permitidas: [], modificadores_opcionales: [], alergenos_declarados: [],
      contacto_cruzado: { state: 'not_assessed' }, etiquetas_dieteticas: [], complementos: []
    }});
    const res = makeRes();
    await createDish(req, res);
    assert.equal(res.statusCode, 201);
    const dishId = res.body && res.body.platillo_id;
    assert.ok(dishId);
    dishIds.push(dishId);

    const row = (await client.query('SELECT * FROM platillos WHERE id=$1', [dishId])).rows[0];
    assert.equal(row.verification_state, 'declared_unverified');
    assert.ok(row.verification_metadata && typeof row.verification_metadata === 'object');
    assert.equal(row.verified_recipe_version, null);
    assert.ok(row.current_recipe_version);
    assert.equal(row.cross_contamination_state, 'not_assessed');

    // retrieve via getDishes (controller/DB)
    const listReq = makeReq({ user, query: {} });
    const listRes = makeRes();
    await getDishes(listReq, listRes);
    assert.equal(listRes.statusCode, 200);
    assert.ok(Array.isArray(listRes.body));
    const found = listRes.body.find(d => d.id === dishId);
    assert.ok(found, 'getDishes should return created dish for same restaurant');
    assert.ok(found.verification_summary);
    assert.equal(found.verification_summary.auto_verified, false);
    assert.ok(Array.isArray(found.ingredientes_principales));
    assert.ok(found.verification_metadata && typeof found.verification_metadata === 'object');
  });
});

test('PostgreSQL integration: update persists allergen states/sections and invalidates on recipe change with audit preserved', async () => {
  await withFixture(async ({ client, user, restaurantId, categoriaId, dishIds }) => {
    let req = makeReq({ user, body: {
      nombre: 'P2', precio: '50', categoria_id: categoriaId,
      ingredientes_principales: ['res'], ingredientes_secundarios: [], salsas: [], aderezos: [], condimentos: [],
      ingredientes_compuestos: [], sustituciones_permitidas: [], modificadores_opcionales: [], alergenos_declarados: [],
      contacto_cruzado: null, etiquetas_dieteticas: [], complementos: []
    }});
    let res = makeRes();
    await createDish(req, res);
    const dishId = res.body.platillo_id;
    dishIds.push(dishId);

    const base = (await client.query('SELECT * FROM platillos WHERE id=$1', [dishId])).rows[0];
    const metaStates = buildConservativeVerificationMetadata({
      ...base,
      ingredientes_compuestos: [{ name: 'salsa secreta', ingredients: [] }],
      contacto_cruzado: { state: 'unknown' },
      alergenos_declarados: ['cacahuate', 'lacteos'],
      allergenAssessments: {
        gluten: { state: 'verified_absent' },
        cacahuate: { state: 'contains' },
        lacteos: { state: 'may_contain' },
        huevo: { state: 'unknown' }
      },
      verification: { state: 'declared_unverified', completenessState: 'incomplete', source: 'test' }
    });
    req = makeReq({ user, params: { id: dishId }, body: {
      nombre: 'P2', precio: '50', categoria_id: categoriaId,
      ingredientes_principales: ['res'], ingredientes_secundarios: [], salsas: [], aderezos: [], condimentos: [],
      ingredientes_compuestos: [{ name: 'salsa secreta', ingredients: [] }],
      sustituciones_permitidas: [], modificadores_opcionales: [], alergenos_declarados: ['cacahuate', 'lacteos'],
      contacto_cruzado: { state: 'unknown' }, etiquetas_dieteticas: [], complementos: [],
      verification_metadata: metaStates, verification_source: 'test'
    }});
    res = makeRes();
    await updateDish(req, res);
    assert.equal(res.statusCode, 200);

    let row = (await client.query('SELECT verification_metadata, ingredientes_compuestos, contacto_cruzado, alergenos_declarados, current_recipe_version FROM platillos WHERE id=$1', [dishId])).rows[0];
    assert.ok(Array.isArray(row.ingredientes_compuestos));
    assert.equal(row.contacto_cruzado.state, 'unknown');
    assert.ok(Array.isArray(row.alergenos_declarados));
    assert.ok(row.verification_metadata && typeof row.verification_metadata === 'object');
    const assessments = (row.verification_metadata.allergenAssessments) || (row.verification_metadata.meta && row.verification_metadata.meta.allergenAssessments) || {};
    assert.equal(assessments.cacahuate && assessments.cacahuate.state, 'contains');
    assert.equal(assessments.lacteos && assessments.lacteos.state, 'may_contain');
    assert.equal(assessments.gluten && assessments.gluten.state, 'verified_absent');
    assert.equal(assessments.huevo && assessments.huevo.state, 'unknown');

    // simulate prior verified approval then change recipe -> invalidate, audit preserved
    const before = (await client.query('SELECT * FROM platillos WHERE id=$1', [dishId])).rows[0];
    const approvedMeta = { ...(before.verification_metadata || {}), verificationState: 'verified_approved', verifiedRecipeVersion: before.current_recipe_version, completeness: { state: 'complete' } };
    await client.query(
      `UPDATE platillos SET verification_state='verified_approved', completeness_state='complete', verified_recipe_version=$2,
       verification_metadata=$3::jsonb, verification_source='test_admin', verified_at=NOW(), verification_updated_at=NOW() WHERE id=$1`,
      [dishId, before.current_recipe_version, JSON.stringify(approvedMeta)]
    );
    await client.query(
      `INSERT INTO platillo_verificacion_auditoria (platillo_id, restaurante_id, accion, estado_anterior, estado_nuevo, actor_rol, motivo)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
      [dishId, restaurantId, 'test_mark_verified', JSON.stringify({ verification_state: before.verification_state }), JSON.stringify({ verification_state: 'verified_approved' }), 'TEST', 'setup']
    );

    req = makeReq({ user, params: { id: dishId }, body: {
      nombre: 'P2', precio: '50', categoria_id: categoriaId,
      ingredientes_principales: ['res', 'nuez'], ingredientes_secundarios: [], salsas: [], aderezos: [], condimentos: [],
      ingredientes_compuestos: [{ name: 'salsa secreta', ingredients: [] }], sustituciones_permitidas: [], modificadores_opcionales: [],
      alergenos_declarados: ['cacahuate', 'lacteos'], contacto_cruzado: { state: 'unknown' }, etiquetas_dieteticas: [], complementos: []
    }});
    res = makeRes();
    await updateDish(req, res);
    assert.equal(res.statusCode, 200);

    row = (await client.query('SELECT verification_state, verified_recipe_version, current_recipe_version FROM platillos WHERE id=$1', [dishId])).rows[0];
    assert.equal(row.verification_state, 'declared_unverified');
    assert.equal(row.verified_recipe_version, null);
    assert.notEqual(row.current_recipe_version, before.current_recipe_version);

    const audit = (await client.query('SELECT accion FROM platillo_verificacion_auditoria WHERE platillo_id=$1 ORDER BY created_at ASC', [dishId])).rows.map(r => r.accion);
    assert.ok(audit.includes('test_mark_verified'));
    assert.ok(audit.some(a => a.includes('invalidated') || a.includes('update')));
  });
});

test('PostgreSQL integration: historical/new records never auto-verified', async () => {
  await withFixture(async ({ client, user, categoriaId, dishIds }) => {
    const req = makeReq({ user, body: {
      nombre: 'Histórico', precio: '10', categoria_id: categoriaId,
      ingredientes_principales: [], ingredientes_secundarios: [], salsas: [], aderezos: [], condimentos: [],
      ingredientes_compuestos: [], sustituciones_permitidas: [], modificadores_opcionales: [], alergenos_declarados: [],
      contacto_cruzado: null, etiquetas_dieteticas: [], complementos: []
    }});
    const res = makeRes();
    await createDish(req, res);
    const dishId = res.body.platillo_id;
    dishIds.push(dishId);
    const row = (await client.query('SELECT verification_state, verified_recipe_version, verification_metadata FROM platillos WHERE id=$1', [dishId])).rows[0];
    assert.equal(row.verified_recipe_version, null);
    assert.notEqual(row.verification_state, 'verified_approved');
    assert.ok(row.verification_metadata);
  });
});

test('PostgreSQL integration: eligibility - unknown/unverifiable cases never compatible; contains/may_contain incompatible', () => {
  const baseVerified = { verificationState: 'verified_approved', completeness: { state: 'complete', missing: [] }, crossContamination: { state: 'verified_controlled' } };
  function evalOne(dish, allergen) {
    const consolidated = {
      effectiveRestrictions: [{ category: 'allergen', normalizedValue: allergen, state: 'desconocido', reason: 'structured_preserved_verification_pending', origin: 'structured', evidence: null, conflicts: [] }],
      conflicts: [], trace: [], summary: { total: 1, counts: {} }
    };
    const e = evaluateDishEligibility(dish, consolidated);
    return e && (e.eligibility || e);
  }
  const contains = evalOne({ verification_metadata: { ...baseVerified, allergenAssessments: { cacahuate: { state: 'contains' } } } }, 'cacahuate');
  assert.notEqual(contains.status, 'compatible_segun_datos');
  if (Object.prototype.hasOwnProperty.call(contains, 'compatible')) assert.equal(contains.compatible, false);

  const may = evalOne({ verification_metadata: { ...baseVerified, allergenAssessments: { lacteos: { state: 'may_contain' } } } }, 'lacteos');
  assert.notEqual(may.status, 'compatible_segun_datos');
  if (Object.prototype.hasOwnProperty.call(may, 'compatible')) assert.equal(may.compatible, false);

  const unknown = evalOne({ verification_metadata: { ...baseVerified, allergenAssessments: { huevo: { state: 'unknown' } } } }, 'huevo');
  assert.notEqual(unknown.status, 'compatible_segun_datos');
  if (Object.prototype.hasOwnProperty.call(unknown, 'compatible')) assert.equal(unknown.compatible, false);

  const incomplete = evalOne({ verification_metadata: { verificationState: 'declared_unverified', completeness: { state: 'incomplete', missing: ['salsas'] }, allergenAssessments: { gluten: { state: 'verified_absent' } } } }, 'gluten');
  assert.notEqual(incomplete.status, 'compatible_segun_datos');

  const compound = evalOne({ ingredientes_compuestos: [{ name: 'salsa secreta', ingredients: [] }], verification_metadata: { ...baseVerified, allergenAssessments: { gluten: { state: 'verified_absent' } } } }, 'gluten');
  assert.notEqual(compound.status, 'compatible_segun_datos');

  const crossUnknown = evalOne({ contacto_cruzado: { state: 'unknown' }, verification_metadata: { ...baseVerified, crossContamination: { state: 'unknown' }, allergenAssessments: { gluten: { state: 'verified_absent' } } } }, 'gluten');
  assert.notEqual(crossUnknown.status, 'compatible_segun_datos');

  const noApproval = evalOne({ verification_metadata: { verificationState: 'declared_unverified', completeness: { state: 'complete', missing: [] }, crossContamination: { state: 'verified_controlled' }, allergenAssessments: { gluten: { state: 'verified_absent' } } } }, 'gluten');
  assert.notEqual(noApproval.status, 'compatible_segun_datos');

  const versionMismatch = evalOne({ current_recipe_version: 'v2', verified_recipe_version: 'v1', verification_metadata: { ...baseVerified, verifiedRecipeVersion: 'v1', allergenAssessments: { gluten: { state: 'verified_absent' } } } }, 'gluten');
  assert.notEqual(versionMismatch.status, 'compatible_segun_datos');
});

test.after(async () => {
  await db.pool.end();
  const redis = require('../../src/config/redis');
  if (redis.isOpen) await redis.quit();
});
