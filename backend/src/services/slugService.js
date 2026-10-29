const db = require('../config/db');

/**
 * Convierte un texto en un slug URL-friendly limpio:
 * - Pasa a minúsculas
 * - Normaliza y remueve diacríticos / acentos (á -> a, ñ -> n)
 * - Remueve caracteres especiales
 * - Reemplaza espacios y guiones múltiples por un solo guión
 */
const generarSlug = (texto) => {
  if (!texto) return 'menu';
  
  const slug = texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'menu';
};

/**
 * Genera un slug garantizando su unicidad en la tabla restaurantes.
 * Si 'taqueria-mexxican' ya existe, genera 'taqueria-mexxican-2', 'taqueria-mexxican-3', etc.
 */
const obtenerSlugUnico = async (nombreNegocio, restauranteId = null) => {
  const baseSlug = generarSlug(nombreNegocio);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = restauranteId
      ? 'SELECT id FROM restaurantes WHERE slug = $1 AND id != $2'
      : 'SELECT id FROM restaurantes WHERE slug = $1';
    const params = restauranteId ? [slug, restauranteId] : [slug];
    
    const res = await db.query(query, params);
    if (res.rows.length === 0) {
      return slug;
    }
    
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
};

module.exports = {
  generarSlug,
  obtenerSlugUnico
};
