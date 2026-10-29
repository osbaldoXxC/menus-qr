const redisClient = require('../config/redis');
const db = require('../config/db');

/**
 * Invalida sincrónicamente todas las claves de caché de menú en Redis para un restaurante.
 * Resuelve y elimina tanto la clave por UUID como la clave por slug URL-friendly,
 * garantizando consistencia inmediata según las directrices de harness-caching.
 * 
 * @param {string} restauranteId - UUID del restaurante
 */
const invalidateMenuCache = async (restauranteId) => {
  if (!restauranteId) return;

  try {
    const keysToDelete = [`cache:menu:${restauranteId}`];

    // Consultar slug del restaurante en la base de datos
    const restRes = await db.query('SELECT slug FROM restaurantes WHERE id = $1', [restauranteId]);
    if (restRes.rows.length > 0 && restRes.rows[0].slug) {
      keysToDelete.push(`cache:menu:${restRes.rows[0].slug}`);
    }

    // Invalidar en paralelo todas las claves asociadas
    const results = await Promise.all(
      keysToDelete.map(async (key) => {
        try {
          return await redisClient.del(key);
        } catch (err) {
          console.warn(`[Cache Invalidation Warning] No se pudo borrar ${key}:`, err.message);
          return 0;
        }
      })
    );

    console.log(`[Cache Invalidation] Llaves invalidadas para restaurante ${restauranteId}:`, keysToDelete);
    return results;
  } catch (error) {
    console.error(`[Cache Invalidation Error] Error al invalidar menú de restaurante ${restauranteId}:`, error);
  }
};

module.exports = {
  invalidateMenuCache
};
