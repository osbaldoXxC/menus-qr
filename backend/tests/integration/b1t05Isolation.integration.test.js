'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const axios = require('axios');
const db = require('../../src/config/db');
const { getPublicRecommendations } = require('../../src/controllers/menuController');

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
function validBody(overrides = {}) {
  return {
    craving: { text: 'plato', tags: [] },
    restrictions: { allergies: [], diet: 'none', excludedIngredients: [] },
    options: { limit: 10 },
    ...overrides
  };
}

async function withTwoRestaurants(fn) {
  const client = await db.pool.connect();
  let r1, r2, c1, c2;
  const dishIds = [];
  const originalAxiosPost = axios.post;
  try {
    axios.post = async () => { throw new Error('ml_unavailable_test'); };

    const insR = async (name, active = true) => (await client.query(
      `INSERT INTO restaurantes (nombre_negocio, email, password_hash, email_verificado, suscripcion_activa, estado)
       VALUES ($1,$2,$3,true,$4,'aprobado') RETURNING id, slug`,
      [name, `b1t05_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`, 'hash', active]
    )).rows[0];
    r1 = await insR('R1 Aislamiento');
    r2 = await insR('R2 Aislamiento');
    c1 = (await client.query(`INSERT INTO categorias_restaurante (restaurante_id, nombre, orden) VALUES ($1,'C',1) RETURNING id`, [r1.id])).rows[0].id;
    c2 = (await client.query(`INSERT INTO categorias_restaurante (restaurante_id, nombre, orden) VALUES ($1,'C',1) RETURNING id`, [r2.id])).rows[0].id;

    const insDish = async (rid, cid, nombre) => {
      const d = (await client.query(
        `INSERT INTO platillos (restaurante_id, categoria_id, nombre, descripcion, precio, activo, ingredientes_principales, complementos, etiquetas_dieteticas, verification_state)
         VALUES ($1,$2,$3,$4,100,true,$5::jsonb,'[]'::jsonb,'[]'::jsonb,'declared_unverified') RETURNING id`,
        [rid, cid, nombre, nombre, JSON.stringify([nombre])]
      )).rows[0].id;
      dishIds.push(d);
      return d;
    };
    const d1 = await insDish(r1.id, c1, 'Plato R1');
    const d2 = await insDish(r2.id, c2, 'Plato R2');

    await fn({ client, r1, r2, d1, d2, setAxiosPost: (fnPost) => { axios.post = fnPost; } });
  } finally {
    axios.post = originalAxiosPost;
    try {
      for (const id of dishIds) await client.query('DELETE FROM platillos WHERE id=$1', [id]);
      if (c1) await client.query('DELETE FROM categorias_restaurante WHERE id=$1', [c1]);
      if (c2) await client.query('DELETE FROM categorias_restaurante WHERE id=$1', [c2]);
      if (r1) await client.query('DELETE FROM restaurantes WHERE id=$1', [r1.id]);
      if (r2) await client.query('DELETE FROM restaurantes WHERE id=$1', [r2.id]);
    } finally {
      client.release();
    }
  }
}

test('B1-T05 aislamiento: recomendación por restaurante no expone platillos de otro restaurante (fallback seguro)', async () => {
  await withTwoRestaurants(async ({ r1, d2 }) => {
    const req = makeReq({ params: { restaurant_id: r1.id }, body: validBody() });
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body && Array.isArray(res.body.recommendations));
    const ids = res.body.recommendations.map(x => x && x.dish && String(x.dish.id));
    assert.ok(!ids.includes(String(d2)), 'no debe incluir platillo de otro restaurante');
    for (const rec of res.body.recommendations) {
      const rid = rec && rec.restaurant && rec.restaurant.id;
      if (rid) assert.equal(String(rid), String(r1.id));
    }
    assert.equal(String(res.body.meta && res.body.meta.restaurant_id), String(r1.id));
  });
});

test('B1-T05 aislamiento: restaurante inexistente responde 404 y restaurante no disponible responde 403', async () => {
  await withTwoRestaurants(async ({ client, r2 }) => {
    let req = makeReq({ params: { restaurant_id: randomUUID() }, body: validBody() });
    let res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 404);

    await client.query('UPDATE restaurantes SET suscripcion_activa=false WHERE id=$1', [r2.id]);
    req = makeReq({ params: { restaurant_id: r2.id }, body: validBody() });
    res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 403);
  });
});

test('B1-T05 aislamiento: respuesta ML con id ajeno al scope se filtra y no se expone cross-tenant', async () => {
  await withTwoRestaurants(async ({ r1, r2, d1, d2, setAxiosPost }) => {
    setAxiosPost(async (url, payload) => String(url).endsWith('/interpret')
      ? { data: { requestId: payload.requestId, extracted: { allergies: [], excludedIngredients: [], diet: 'none', ambiguous: false } } }
      : { data: { requestId: payload.requestId, ranked: [
        { dishId: d2, score: 0.99, reasons: ['ajeno'] },
        { dishId: d1, score: 0.9, reasons: ['propio'] }
      ] } });
    const req = makeReq({ params: { restaurant_id: r1.id }, body: validBody() });
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body && Array.isArray(res.body.recommendations));
    const ids = res.body.recommendations.map(x => x && x.dish && String(x.dish.id));
    assert.ok(!ids.includes(String(d2)), 'id de platillo ajeno devuelto por ML debe ser descartado');
    assert.ok(ids.includes(String(d1)), 'id elegible del scope debe poder retornarse');
  });
});

test('B1-T05 aislamiento: respuesta ML con id desconocido/inexistente se descarta sin inventar ni exponer datos', async () => {
  await withTwoRestaurants(async ({ r1, setAxiosPost }) => {
    setAxiosPost(async () => ({ data: { recommendations: [{ dish: { id: randomUUID() }, matchScore: 0.99 }] } }));
    const req = makeReq({ params: { restaurant_id: r1.id }, body: validBody() });
    const res = makeRes();
    await getPublicRecommendations(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body && Array.isArray(res.body.recommendations));
    assert.equal(String(res.body.meta && res.body.meta.restaurant_id), String(r1.id));
  });
});

test.after(async () => {
  await db.pool.end();
  const redis = require('../../src/config/redis');
  if (redis.isOpen) await redis.quit();
});
