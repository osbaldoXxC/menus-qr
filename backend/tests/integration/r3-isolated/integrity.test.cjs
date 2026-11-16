'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const dish = '30000000-0000-4000-8000-000000000001';
const otherDish = '30000000-0000-4000-8000-000000000002';

async function isolated(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await fn(c); } finally { await c.query('ROLLBACK'); c.release(); }
}
async function rejected(c, query, params, code) {
  await c.query('SAVEPOINT rejected_attempt');
  await assert.rejects(c.query(query, params), { code });
  await c.query('ROLLBACK TO SAVEPOINT rejected_attempt');
}
test('R3 SQL real: price and recipe ABA changes never resurrect versions', () => isolated(async c => {
  const original = (await c.query('SELECT * FROM platillos WHERE id=$1', [dish])).rows[0];
  await c.query('UPDATE platillos SET precio=precio+1, descripcion=$2 WHERE id=$1', [dish, 'version temporal']);
  await c.query('UPDATE platillos SET precio=$2, descripcion=$3 WHERE id=$1', [dish, original.precio, original.descripcion]);
  const final = (await c.query('SELECT * FROM platillos WHERE id=$1', [dish])).rows[0];
  assert.notEqual(final.evidencia_precio_revision, original.evidencia_precio_revision);
  assert.notEqual(final.evidencia_receta_revision, original.evidencia_receta_revision);
}));
test('R3 SQL real: changing relational recipe invalidates without assuming JSON correspondence', () => isolated(async c => {
  const original = (await c.query('SELECT evidencia_receta_revision FROM platillos WHERE id=$1', [dish])).rows[0];
  const ingredient = (await c.query("INSERT INTO ingredientes_catalogo (nombre) VALUES ('R3 synthetic ingredient') RETURNING id")).rows[0];
  await c.query('INSERT INTO receta_platillo (platillo_id,ingrediente_id) VALUES ($1,$2)', [dish, ingredient.id]);
  const inserted = (await c.query('SELECT evidencia_receta_revision FROM platillos WHERE id=$1', [dish])).rows[0];
  assert.notEqual(inserted.evidencia_receta_revision, original.evidencia_receta_revision);
  await c.query('UPDATE ingredientes_catalogo SET nombre=$2 WHERE id=$1', [ingredient.id, 'R3 synthetic updated']);
  const changed = (await c.query('SELECT evidencia_receta_revision FROM platillos WHERE id=$1', [dish])).rows[0];
  assert.notEqual(changed.evidencia_receta_revision, inserted.evidencia_receta_revision);
}));
test('R3 SQL real: approved taxonomy immutable, retired cannot reopen', () => isolated(async c => {
  await rejected(c, "UPDATE exclusion_termino SET fuente='changed' WHERE grupo='cerdo' AND version=1", [], 'P0001');
  await c.query("UPDATE exclusion_grupo_version SET estado='retirada' WHERE grupo='cerdo' AND version=1");
  await rejected(c, "UPDATE exclusion_grupo_version SET estado='aprobada' WHERE grupo='cerdo' AND version=1", [], 'P0001');
}));
test('R3 SQL real: stale price and cross-tenant coverage rejected', () => isolated(async c => {
  const header = (await c.query(`INSERT INTO confirmacion_moneda_restaurante
    (restaurante_id,moneda,catalogo_huella,actor_id,actor_tipo,procedencia)
    VALUES ($1,'MXN',$2,$1,'RESTAURANTE','synthetic test') RETURNING id`, [owner, 'a'.repeat(64)])).rows[0];
  await rejected(c, `INSERT INTO confirmacion_precio_platillo
    (confirmacion_id,restaurante_id,platillo_id,precio_confirmado,version_precio) VALUES ($1,$2,$3,1,'stale')`,
  [header.id, owner, dish], 'P0001');
  await rejected(c, `INSERT INTO confirmacion_precio_platillo
    (confirmacion_id,restaurante_id,platillo_id,precio_confirmado,version_precio) VALUES ($1,$2,$3,52,'stale')`,
  [header.id, owner, otherDish], 'P0001');
  await rejected(c, `INSERT INTO confirmacion_moneda_restaurante
    (restaurante_id,moneda,catalogo_huella,actor_id,actor_tipo,procedencia)
    VALUES ($1,'MXN',$2,$3,'RESTAURANTE','synthetic test')`, [owner, 'a'.repeat(64), other], '23514');
}));
test('R3 SQL real: revoked evidence cannot be changed or unrevoked', () => isolated(async c => {
  const row = (await c.query('SELECT id FROM confirmacion_moneda_restaurante WHERE restaurante_id=$1 AND revocado_en IS NOT NULL LIMIT 1', [owner])).rows[0];
  assert.ok(row);
  await rejected(c, 'UPDATE confirmacion_moneda_restaurante SET revocado_en=NULL,revocado_por=NULL,motivo_revocacion=NULL WHERE id=$1', [row.id], 'P0001');
  await rejected(c, 'DELETE FROM confirmacion_moneda_restaurante WHERE id=$1', [row.id], 'P0001');
}));
test.after(async () => pool.end());
