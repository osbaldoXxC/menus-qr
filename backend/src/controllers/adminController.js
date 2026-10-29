const db = require('../config/db');
const redisClient = require('../config/redis');
const { invalidateMenuCache } = require('../services/cacheService');

const getAllRestaurants = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.id, 
        r.nombre_negocio, 
        r.nombre_dueno as "nombre_dueño", 
        r.email, 
        COALESCE(r.plan, 'basico') as plan, 
        r.suscripcion_activa, 
        COALESCE(r.estado, CASE WHEN r.suscripcion_activa = true THEN 'aprobado' ELSE 'suspendido' END) as estado, 
        r.suscripcion_expira_en, 
        COALESCE(r.dias_licencia, 30) as dias_licencia,
        r.created_at,
        (SELECT COUNT(*)::int FROM platillos p WHERE p.restaurante_id = r.id) as total_platillos
      FROM restaurantes r
      WHERE r.rol != 'SUPER_ADMIN'
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener lista de restaurantes:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const logAuditoria = async (client, restaurante_id, accion, plan_anterior, plan_nuevo, detalles, admin_id) => {
  await client.query(
    'INSERT INTO historial_suscripciones (restaurante_id, plan_anterior, plan_nuevo, razon) VALUES ($1, $2, $3, $4)',
    [restaurante_id, plan_anterior, plan_nuevo, detalles]
  );
};

const approveRestaurant = async (req, res) => {
  const { id } = req.params;
  const dias = Math.max(1, parseInt(req.body.dias_licencia || req.body.dias || req.body.dias_acceso_permitidos || 30));
  const plan = req.body.plan || null;
  const modo = req.body.modo || 'set';
  const admin_id = req.user.id;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    
    // Get prev plan
    const prevRes = await client.query('SELECT plan FROM restaurantes WHERE id = $1', [id]);
    const plan_anterior = prevRes.rows.length ? prevRes.rows[0].plan : null;

    const result = await client.query(
      `UPDATE restaurantes 
       SET estado = 'aprobado', 
           suscripcion_activa = true, 
           dias_licencia = $1::int, 
           suscripcion_expira_en = CASE 
             WHEN $2 = 'add' AND suscripcion_expira_en IS NOT NULL AND suscripcion_expira_en > CURRENT_TIMESTAMP 
               THEN suscripcion_expira_en + ($1::int * INTERVAL '1 day')
             ELSE CURRENT_TIMESTAMP + ($1::int * INTERVAL '1 day')
           END,
           plan = COALESCE($3, plan)
       WHERE id = $4 
       RETURNING id, nombre_negocio, estado, suscripcion_activa, dias_licencia, suscripcion_expira_en, plan`,
      [dias, modo, plan, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    const plan_nuevo = result.rows[0].plan;
    await logAuditoria(client, id, 'RENOVAR_O_ACTIVAR', plan_anterior, plan_nuevo, `Modo: ${modo}, Días: ${dias}`, admin_id);

    await client.query('COMMIT');
    await invalidateMenuCache(id);

    res.json({
      mensaje: 'Tiempo de suscripción actualizado correctamente',
      restaurante: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al aprobar o modificar tiempo de restaurante:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al actualizar el restaurante' });
  } finally {
    client.release();
  }
};

const cancelRestaurantAccess = async (req, res) => {
  const { id } = req.params;
  const admin_id = req.user.id;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const prevRes = await client.query('SELECT plan FROM restaurantes WHERE id = $1', [id]);
    const plan = prevRes.rows.length ? prevRes.rows[0].plan : null;

    // 1. Suspender restaurante
    const result = await client.query(
      `UPDATE restaurantes
       SET estado = 'suspendido',
           suscripcion_activa = false
       WHERE id = $1
       RETURNING id, nombre_negocio, estado, suscripcion_activa`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    // 2. Invalidar todos los refresh tokens activos del restaurante
    await client.query(
      'DELETE FROM refresh_tokens WHERE restaurante_id = $1',
      [id]
    );

    // 3. Desactivar todos los platillos (pausado lógico)
    await client.query(
      'UPDATE platillos SET activo = false WHERE restaurante_id = $1',
      [id]
    );
    
    await logAuditoria(client, id, 'SUSPENDER', plan, plan, 'Acceso cancelado (Kill Switch)', admin_id);

    await client.query('COMMIT');

    // 4. Purgar caché de Redis
    await invalidateMenuCache(id);
    await redisClient.del('cache:busquedas_globales');

    res.json({
      mensaje: 'Kill Switch ejecutado: Acceso cancelado, platillos pausados y caché eliminada.',
      restaurante: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al suspender restaurante:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al cancelar acceso' });
  } finally {
    client.release();
  }
};

const updateRestaurantStatus = async (req, res) => {
  const { id } = req.params;
  const { estado, dias_licencia, plan } = req.body;
  let suscripcion_activa = req.body.suscripcion_activa;
  const admin_id = req.user.id;

  if (suscripcion_activa === undefined && req.body.estado_activo !== undefined) {
    suscripcion_activa = req.body.estado_activo;
  }

  // Si se envía estado expreso ('aprobado', 'suspendido', 'pendiente')
  let finalEstado = estado;
  if (!finalEstado && suscripcion_activa !== undefined) {
    finalEstado = suscripcion_activa ? 'aprobado' : 'suspendido';
  }
  if (suscripcion_activa === undefined && finalEstado) {
    suscripcion_activa = finalEstado === 'aprobado';
  }

  const dias = dias_licencia || req.body.dias ? parseInt(dias_licencia || req.body.dias) : null;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const prevRes = await client.query('SELECT plan FROM restaurantes WHERE id = $1', [id]);
    const plan_anterior = prevRes.rows.length ? prevRes.rows[0].plan : null;

    const result = await client.query(
      `UPDATE restaurantes 
       SET suscripcion_activa = COALESCE($1, suscripcion_activa),
           estado = COALESCE($2, estado),
           dias_licencia = COALESCE($3::int, dias_licencia),
           suscripcion_expira_en = CASE 
             WHEN $3::int IS NOT NULL THEN CURRENT_TIMESTAMP + ($3::int * INTERVAL '1 day')
             ELSE suscripcion_expira_en
           END,
           plan = COALESCE($4, plan)
       WHERE id = $5 
       RETURNING id, nombre_negocio, suscripcion_activa, estado, dias_licencia, suscripcion_expira_en, plan`,
      [
        suscripcion_activa !== undefined ? suscripcion_activa : null,
        finalEstado || null,
        dias,
        plan || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    const plan_nuevo = result.rows[0].plan;
    await logAuditoria(client, id, 'ACTUALIZAR_ESTADO', plan_anterior, plan_nuevo, `Estado: ${finalEstado}, Días: ${dias}`, admin_id);

    await client.query('COMMIT');
    await invalidateMenuCache(id);

    res.json({
      mensaje: 'Estado del restaurante actualizado y caché purgado',
      restaurante: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar estado de restaurante:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const getAuditHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT h.*, a.nombre_dueno as admin_nombre 
       FROM historial_suscripciones h
       LEFT JOIN restaurantes a ON h.admin_id = a.id
       WHERE h.restaurante_id = $1 
       ORDER BY h.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllRestaurants,
  approveRestaurant,
  cancelRestaurantAccess,
  updateRestaurantStatus,
  getAuditHistory
};
