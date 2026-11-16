'use strict';

const { attachEvidence } = require('../services/catalogEvidence');

// One statement snapshot: dish, price, absence and taxonomy cannot come from
// different committed instants. No cache of safety evidence.
const SNAPSHOT_SQL = `SELECT p.*, c.nombre AS categoria_nombre,
  r.nombre_negocio AS restaurante_nombre, r.slug AS restaurante_slug,
  r.suscripcion_activa AS restaurante_activo,
  EXISTS(SELECT 1 FROM receta_platillo rp WHERE rp.platillo_id = p.id) AS has_relational_recipe,
  COALESCE((SELECT jsonb_agg(to_jsonb(m) || to_jsonb(cp))
    FROM confirmacion_precio_platillo cp JOIN confirmacion_moneda_restaurante m
      ON m.id = cp.confirmacion_id AND m.restaurante_id = cp.restaurante_id
    WHERE cp.platillo_id = p.id AND cp.restaurante_id = p.restaurante_id), '[]') AS evidence_prices,
  COALESCE((SELECT jsonb_agg(a) FROM platillo_ausencia_confirmada a
    WHERE a.platillo_id = p.id AND a.restaurante_id = p.restaurante_id), '[]') AS evidence_absences,
  COALESCE((SELECT jsonb_agg(to_jsonb(g) || jsonb_build_object('terms',
    COALESCE((SELECT jsonb_agg(t) FROM exclusion_termino t WHERE t.grupo = g.grupo AND t.version = g.version), '[]')))
    FROM exclusion_grupo_version g WHERE g.estado = 'aprobada'), '[]') AS evidence_taxonomy
  FROM platillos p JOIN restaurantes r ON r.id = p.restaurante_id
  LEFT JOIN categorias_restaurante c ON c.id = p.categoria_id
  WHERE p.id = ANY($1::uuid[]) AND ($2::uuid IS NULL OR p.restaurante_id = $2)`;

async function snapshots(database, ids, restaurantId = null) {
  if (!ids.length) return [];
  const { rows } = await database.query(SNAPSHOT_SQL, [ids, restaurantId]);
  return rows.map(row => {
    const { evidence_prices = [], evidence_absences = [], evidence_taxonomy = [], ...dish } = row;
    return attachEvidence(dish, { prices: evidence_prices, absences: evidence_absences, taxonomy: evidence_taxonomy });
  });
}

async function enrichCandidates(database, dishes, restaurantId = null) {
  // Pre-migration rows are explicitly unknown. Plain cravings still work.
  if (!dishes.some(d => d.evidencia_precio_revision)) return dishes;
  return (await snapshots(database, dishes.map(d => d.id), restaurantId))
    .filter(d => d.activo === true && d.restaurante_activo === true);
}

async function transaction(database, work) {
  const client = await database.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function audit(client, actor, action, id, detail) {
  await client.query(`INSERT INTO catalogo_evidencia_auditoria
    (restaurante_id, actor_id, accion, evidencia_id, detalle) VALUES ($1,$1,$2,$3,$4)`,
  [actor.id, action, id, JSON.stringify(detail)]);
}

module.exports = { snapshots, enrichCandidates, transaction, audit };
