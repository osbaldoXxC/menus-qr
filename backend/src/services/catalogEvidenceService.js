'use strict';

const { z } = require('zod');
const repository = require('../repositories/catalogEvidenceRepository');
const { SECTIONS, priceCents, catalogFingerprint, getEvidence, resolveGroup,
  recipeAssessment, currencyVerified, evaluateExclusion } = require('./catalogEvidence');
const { computeRecipeVersion } = require('./catalogVerification');

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.string().trim().min(1).max(1000);
const sectionSchema = z.object(Object.fromEntries(SECTIONS.map(s =>
  [s, z.enum(['complete', 'not_applicable_declared'])]))).strict();
const currencySchema = z.object({ currency: z.literal('MXN'), source,
  catalogFingerprint: hash,
  dishes: z.array(z.object({ id: uuid, price: z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/),
    priceRevision: uuid }).strict()).min(1).max(100)
}).strict();
const absenceSchema = z.object({ source, recipeVersion: hash, recipeRevision: uuid,
  group: z.string().min(1).max(100), taxonomyVersion: z.number().int().positive(),
  taxonomyRevision: uuid, sections: sectionSchema }).strict();
const revocationSchema = z.object({ reason: source }).strict();

function fail(status, code) { throw Object.assign(new Error(code), { status, code }); }
function parse(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail(400, 'INVALID_EVIDENCE_REQUEST');
  return parsed.data;
}
function authorize(actor, restaurantId) {
  if (!actor || actor.rol !== 'RESTAURANTE' || actor.id !== restaurantId) fail(403, 'EVIDENCE_FORBIDDEN');
  parse(uuid, restaurantId);
}
async function authorizeStored(client, actor) {
  const { rows } = await client.query('SELECT id, rol FROM restaurantes WHERE id = $1 FOR SHARE', [actor.id]);
  if (rows.length !== 1 || rows[0].rol !== 'RESTAURANTE') fail(403, 'EVIDENCE_FORBIDDEN');
}
async function lockDishes(client, actor, ids) {
  if (new Set(ids).size !== ids.length) fail(400, 'DUPLICATE_DISH');
  const { rows } = await client.query(`SELECT * FROM platillos
    WHERE restaurante_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE`, [actor.id, ids]);
  if (rows.length !== ids.length) fail(404, 'DISH_NOT_FOUND');
  return rows;
}

function createCatalogEvidenceService(database) {
  const ownedTransaction = (actor, restaurantId, work) => {
    authorize(actor, restaurantId);
    return repository.transaction(database, async client => {
      await authorizeStored(client, actor);
      return work(client);
    });
  };

  async function confirmCurrency(actor, restaurantId, input) {
    const data = parse(currencySchema, input);
    return ownedTransaction(actor, restaurantId, async client => {
      const dishes = await lockDishes(client, actor, data.dishes.map(d => d.id));
      if (catalogFingerprint(dishes) !== data.catalogFingerprint) fail(409, 'CATALOG_CHANGED');
      for (const dish of dishes) {
        const expected = data.dishes.find(d => d.id === dish.id);
        if (dish.evidencia_precio_revision !== expected.priceRevision ||
            priceCents(dish.precio) !== priceCents(expected.price)) fail(409, 'PRICE_CHANGED');
      }
      const result = await client.query(`INSERT INTO confirmacion_moneda_restaurante
        (restaurante_id, moneda, catalogo_huella, actor_id, actor_tipo, procedencia)
        VALUES ($1,'MXN',$2,$1,'RESTAURANTE',$3) RETURNING id`, [actor.id, data.catalogFingerprint, data.source]);
      const id = result.rows[0].id;
      for (const dish of dishes) {
        await client.query(`INSERT INTO confirmacion_precio_platillo
          (confirmacion_id, restaurante_id, platillo_id, precio_confirmado, version_precio)
          VALUES ($1,$2,$3,$4,$5)`, [id, actor.id, dish.id, dish.precio, dish.evidencia_precio_revision]);
      }
      await repository.audit(client, actor, 'confirm_currency', id, { dishes: data.dishes, source: data.source });
      return { id };
    });
  }

  async function confirmAbsence(actor, restaurantId, dishId, input) {
    parse(uuid, dishId);
    const data = parse(absenceSchema, input);
    return ownedTransaction(actor, restaurantId, async client => {
      const [dish] = await lockDishes(client, actor, [dishId]);
      if (computeRecipeVersion(dish) !== data.recipeVersion || dish.evidencia_receta_revision !== data.recipeRevision) fail(409, 'RECIPE_CHANGED');
      // Lock review state; term writers lock this same row. No approval race.
      await client.query('SELECT grupo FROM exclusion_grupo_version WHERE grupo = $1 AND version = $2 FOR SHARE', [data.group, data.taxonomyVersion]);
      const [snapshot] = await repository.snapshots(client, [dishId], actor.id);
      const taxonomy = resolveGroup(data.group, getEvidence(snapshot).taxonomy);
      if (!taxonomy || taxonomy.version !== data.taxonomyVersion || taxonomy.revision !== data.taxonomyRevision) fail(409, 'TAXONOMY_CHANGED_OR_UNKNOWN');
      if (recipeAssessment(snapshot, data.sections, taxonomy).state !== 'compatible_segun_datos') fail(422, 'RECIPE_INSUFFICIENT_OR_INCOMPATIBLE');
      const result = await client.query(`INSERT INTO platillo_ausencia_confirmada
        (restaurante_id, platillo_id, grupo, taxonomia_version, receta_version, receta_revision,
         taxonomia_revision, secciones, actor_id, actor_tipo, procedencia)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$1,'RESTAURANTE',$9) RETURNING id`,
      [actor.id, dishId, data.group, data.taxonomyVersion, data.recipeVersion, data.recipeRevision,
        data.taxonomyRevision, JSON.stringify(data.sections), data.source]);
      const id = result.rows[0].id;
      await repository.audit(client, actor, 'confirm_absence', id, { dishId, ...data });
      return { id };
    });
  }

  async function revoke(actor, restaurantId, kind, id, input) {
    parse(uuid, id);
    const data = parse(revocationSchema, input);
    const table = { currency: 'confirmacion_moneda_restaurante', absence: 'platillo_ausencia_confirmada' }[kind];
    if (!table) fail(400, 'INVALID_EVIDENCE_KIND');
    return ownedTransaction(actor, restaurantId, async client => {
      const result = await client.query(`UPDATE ${table} SET revocado_en = now(), revocado_por = $1, motivo_revocacion = $2
        WHERE id = $3 AND restaurante_id = $1 AND revocado_en IS NULL RETURNING id`, [actor.id, data.reason, id]);
      if (!result.rows.length) fail(404, 'ACTIVE_EVIDENCE_NOT_FOUND');
      await repository.audit(client, actor, `revoke_${kind}`, id, data);
      return { id, revoked: true };
    });
  }

  async function inspect(actor, restaurantId, dishId) {
    parse(uuid, dishId);
    return ownedTransaction(actor, restaurantId, async client => {
      const [dish] = await repository.snapshots(client, [dishId], actor.id);
      if (!dish) fail(404, 'DISH_NOT_FOUND');
      const evidence = getEvidence(dish);
      return { dish, recipeVersion: computeRecipeVersion(dish), catalogFingerprint: catalogFingerprint([dish]),
        currencyState: currencyVerified(dish) ? 'confirmed' : 'unknown', evidence,
        exclusions: evidence.taxonomy.map(t => ({ group: t.grupo, ...evaluateExclusion(dish, t.grupo) })) };
    });
  }

  return { confirmCurrency, confirmAbsence, revoke, inspect };
}
module.exports = { createCatalogEvidenceService, authorize, currencySchema, absenceSchema };
