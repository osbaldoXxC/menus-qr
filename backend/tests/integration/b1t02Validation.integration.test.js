'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const db = require('../../src/config/db');
const { getPublicRecommendations, getGlobalRecommendations } = require('../../src/controllers/menuController');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
function makeReq({ body = {}, params = {} }) {
  return { body, params };
}

async function withRestaurant(fn) {
  const client = await db.pool.connect();
  let r1, c1;
  const dishIds = [];
  const originalAxiosPost = axios.post;
  try {
    axios.post = async () => { throw new Error('ml_unavailable_test'); };
    r1 = (await client.query(
      `INSERT INTO restaurantes (nombre_negocio, email, password_hash, email_verificado, suscripcion_activa, estado)
       VALUES ($1,$2,$3,true,true,'aprobado') RETURNING id, slug`,
      ['R1 B1T02', `b1t02_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`, 'hash']
    )).rows[0];
    c1 = (await client.query(`INSERT INTO categorias_restaurante (restaurante_id, nombre, orden) VALUES ($1,'C',1) RETURNING id`, [r1.id])).rows[0].id;
    const d = (await client.query(
      `INSERT INTO platillos (restaurante_id, categoria_id, nombre, descripcion, precio, activo, ingredientes_principales, complementos, etiquetas_dieteticas, verification_state)
       VALUES ($1,$2,'Plato','desc',100,true,'["pollo"]'::jsonb,'[]'::jsonb,'[]'::jsonb,'declared_unverified') RETURNING id`,
      [r1.id, c1]
    )).rows[0].id;
    dishIds.push(d);
    await fn({ client, r1, d1: d });
  } finally {
    axios.post = originalAxiosPost;
    try {
      for (const id of dishIds) await client.query('DELETE FROM platillos WHERE id=$1', [id]);
      if (c1) await client.query('DELETE FROM categorias_restaurante WHERE id=$1', [c1]);
      if (r1) await client.query('DELETE FROM restaurantes WHERE id=$1', [r1.id]);
    } finally {
      client.release();
    }
  }
}

test('B1-T02 integración: payload inválido en recomendación por restaurante retorna 400 uniforme INVALID_REQUEST', async () => {
  await withRestaurant(async ({ r1 }) => {
    const req = makeReq({ params: { restaurant_id: r1.id }, body: { limit: 11 } });
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body);
    assert.equal(res.body.error && res.body.error.code, 'INVALID_REQUEST');
    assert.equal(res.body.status && res.body.status.code, 'invalid_request');
    assert.ok(Array.isArray(res.body.error.details));
    assert.ok(res.body.meta && typeof res.body.meta.requestId === 'string');
    assert.equal(res.body.meta.limitApplied, 5);
    assert.deepEqual(res.body.recommendations, []);
  });
});

test('B1-T02 integración: payload DEC-012 válido se acepta y mantiene el ámbito del restaurante', async () => {
  await withRestaurant(async ({ r1 }) => {
    const req = makeReq({
      params: { restaurant_id: r1.id },
      body: { craving: { text: 'pollo', tags: [] }, restrictions: { diet: 'none', allergies: [] }, options: { limit: 3 } }
    });
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body && Array.isArray(res.body.recommendations));
    assert.ok(res.body.meta);
    assert.equal(String(res.body.meta.restaurant_id), String(r1.id));
  });
});

test('B1-T02 integración: payload inválido en recomendación global retorna 400 uniforme INVALID_REQUEST', async () => {
  await withRestaurant(async () => {
    const req = makeReq({ params: {}, body: { diet: 'keto' } });
    const res = makeRes();
    await getGlobalRecommendations(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error && res.body.error.code, 'INVALID_REQUEST');
    assert.equal(res.body.status && res.body.status.code, 'invalid_request');
    assert.ok(res.body.meta && typeof res.body.meta.requestId === 'string');
  });
});

test.after(async () => {
  await db.pool.end();
  const redis = require('../../src/config/redis');
  if (redis.isOpen) await redis.quit();
});
