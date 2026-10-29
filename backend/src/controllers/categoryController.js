const db = require('../config/db');
const redisClient = require('../config/redis');
const { invalidateMenuCache } = require('../services/cacheService');

const createCategory = async (req, res) => {
  const { nombre, orden } = req.body;
  const restaurante_id = req.user.id;

  if (!nombre) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio' });
  }

  try {
    const SubscriptionService = require('../services/subscriptionService');
    const limitCheck = await SubscriptionService.canCreateCategory(restaurante_id);
    if (!limitCheck.allowed) {
      return res.status(403).json({ mensaje: limitCheck.reason, limit: limitCheck.max });
    }

    // Si no se provee orden, buscamos el máximo actual + 1
    let finalOrden = orden;
    if (orden === undefined) {
      const maxOrdenRes = await db.query(
        'SELECT COALESCE(MAX(orden), -1) as max_orden FROM categorias_restaurante WHERE restaurante_id = $1',
        [restaurante_id]
      );
      finalOrden = maxOrdenRes.rows[0].max_orden + 1;
    }

    const result = await db.query(
      'INSERT INTO categorias_restaurante (nombre, restaurante_id, orden) VALUES ($1, $2, $3) RETURNING id, nombre, orden',
      [nombre, restaurante_id, finalOrden]
    );

    // Invalida caché del menú
    await invalidateMenuCache(restaurante_id);

    res.status(201).json({
      mensaje: 'Categoría creada correctamente',
      categoria: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre en tu restaurante' });
    }
    console.error('Error al crear categoría:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getCategories = async (req, res) => {
  const restaurante_id = req.user.id;

  try {
    const result = await db.query(
      'SELECT id, nombre, orden FROM categorias_restaurante WHERE restaurante_id = $1 ORDER BY orden ASC, nombre ASC',
      [restaurante_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  const restaurante_id = req.user.id;

  if (!nombre) {
    return res.status(400).json({ mensaje: 'El nombre es obligatorio' });
  }

  try {
    const result = await db.query(
      'UPDATE categorias_restaurante SET nombre = $1 WHERE id = $2 AND restaurante_id = $3 RETURNING id, nombre, orden',
      [nombre, id, restaurante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Categoría no encontrada o no tienes permisos' });
    }

    await invalidateMenuCache(restaurante_id);

    res.json({
      mensaje: 'Categoría actualizada correctamente',
      categoria: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const restaurante_id = req.user.id;

  try {
    // Verificar si la categoría tiene platillos vinculados
    const dishCount = await db.query(
      'SELECT COUNT(*) FROM platillos WHERE categoria_id = $1',
      [id]
    );

    if (parseInt(dishCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        mensaje: 'No puedes eliminar una categoría que tiene platillos vinculados. Por favor, reubica o elimina los platillos primero.' 
      });
    }

    const result = await db.query(
      'DELETE FROM categorias_restaurante WHERE id = $1 AND restaurante_id = $2 RETURNING id',
      [id, restaurante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Categoría no encontrada o no tienes permisos' });
    }

    await invalidateMenuCache(restaurante_id);

    res.json({ mensaje: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const reorderCategories = async (req, res) => {
  const { categorias } = req.body; // Expects [{ id, orden }, ...]
  const restaurante_id = req.user.id;

  if (!categorias || !Array.isArray(categorias)) {
    return res.status(400).json({ mensaje: 'Se requiere un arreglo de categorías con su nuevo orden' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of categorias) {
      await client.query(
        'UPDATE categorias_restaurante SET orden = $1 WHERE id = $2 AND restaurante_id = $3',
        [item.orden, item.id, restaurante_id]
      );
    }

    await client.query('COMMIT');
    await invalidateMenuCache(restaurante_id);

    res.json({ mensaje: 'Orden de categorías actualizado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al reordenar categorías:', error);
    res.status(500).json({ mensaje: 'Error interno al reordenar' });
  } finally {
    client.release();
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  reorderCategories
};
