const db = require('../config/db');

const PLANES = {
  prueba: {
    nombre: 'Prueba Gratuita',
    max_platillos: 100,
    max_categorias: 10,
    max_menus: 2,
    max_imagenes: 100,
    features: {
      imagen_fondo: true,
      banner_promocional: true,
      configuracion_diseno: true,
      soporte_premium: true
    }
  },
  estandar: {
    nombre: 'Plan Estándar',
    max_platillos: 50,
    max_categorias: 5,
    max_menus: 1,
    max_imagenes: 10,
    features: {
      imagen_fondo: false,
      banner_promocional: false,
      configuracion_diseno: false,
      soporte_premium: false
    }
  },
  premium: {
    nombre: 'Plan Premium',
    max_platillos: 500,
    max_categorias: 50,
    max_menus: 10,
    max_imagenes: 500,
    features: {
      imagen_fondo: true,
      banner_promocional: true,
      configuracion_diseno: true,
      soporte_premium: true
    }
  }
};

class SubscriptionService {
  /**
   * Obtiene la configuración del plan actual de un restaurante
   */
  static getPlanConfig(planId) {
    return PLANES[planId] || PLANES['estandar'];
  }

  /**
   * Verifica si un restaurante tiene acceso a una característica específica
   */
  static async hasFeature(restauranteId, featureKey) {
    const { rows } = await db.query(
      'SELECT plan, suscripcion_activa FROM restaurantes WHERE id = $1',
      [restauranteId]
    );

    if (rows.length === 0) return false;
    
    const user = rows[0];
    if (!user.suscripcion_activa) return false;

    const planConfig = this.getPlanConfig(user.plan);
    return !!planConfig.features[featureKey];
  }

  /**
   * Verifica si un restaurante puede crear más platillos
   */
  static async canCreatePlatillo(restauranteId) {
    const { rows: restRows } = await db.query(
      'SELECT plan, suscripcion_activa FROM restaurantes WHERE id = $1',
      [restauranteId]
    );

    if (restRows.length === 0 || !restRows[0].suscripcion_activa) {
      return { allowed: false, reason: 'Suscripción inactiva', max: 0, current: 0 };
    }

    const planConfig = this.getPlanConfig(restRows[0].plan);

    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) as total FROM platillos WHERE restaurante_id = $1',
      [restauranteId]
    );

    const currentCount = parseInt(countRows[0].total, 10);
    const maxPlatillos = planConfig.max_platillos;

    if (currentCount >= maxPlatillos) {
      return { allowed: false, reason: 'Límite de platillos alcanzado', max: maxPlatillos, current: currentCount };
    }

    return { allowed: true, max: maxPlatillos, current: currentCount };
  }

  static async canCreateCategory(restauranteId) {
    const { rows: restRows } = await db.query(
      'SELECT plan, suscripcion_activa FROM restaurantes WHERE id = $1',
      [restauranteId]
    );

    if (restRows.length === 0 || !restRows[0].suscripcion_activa) {
      return { allowed: false, reason: 'Suscripción inactiva', max: 0, current: 0 };
    }

    const planConfig = this.getPlanConfig(restRows[0].plan);

    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) as total FROM categorias_restaurante WHERE restaurante_id = $1',
      [restauranteId]
    );

    const currentCount = parseInt(countRows[0].total, 10);
    const maxCategorias = planConfig.max_categorias || 5;

    if (currentCount >= maxCategorias) {
      return { allowed: false, reason: 'Límite de categorías alcanzado', max: maxCategorias, current: currentCount };
    }

    return { allowed: true, max: maxCategorias, current: currentCount };
  }
  
  /**
   * Obtiene estadísticas de uso para el restaurante
   */
  static async getUsageStats(restauranteId) {
     const { rows: restRows } = await db.query(
      'SELECT plan, suscripcion_activa, suscripcion_expira_en, estado, dias_licencia FROM restaurantes WHERE id = $1',
      [restauranteId]
    );

    if (restRows.length === 0) {
      throw new Error('Restaurante no encontrado');
    }

    const planConfig = this.getPlanConfig(restRows[0].plan);

    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) as total FROM platillos WHERE restaurante_id = $1',
      [restauranteId]
    );

    const currentCount = parseInt(countRows[0].total, 10);
    
    let dias_restantes = 0;
    if (restRows[0].suscripcion_expira_en) {
      const expDate = new Date(restRows[0].suscripcion_expira_en);
      // Calcular la diferencia exacta en milisegundos y usar Math.ceil para no perder el día en curso
      const diffTime = expDate.getTime() - Date.now();
      dias_restantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (restRows[0].suscripcion_activa) {
      const dias = restRows[0].dias_licencia && restRows[0].dias_licencia > 0 ? restRows[0].dias_licencia : 30;
      dias_restantes = dias;
      db.query(
        `UPDATE restaurantes 
         SET suscripcion_expira_en = CURRENT_TIMESTAMP + ($1::int * INTERVAL '1 day') 
         WHERE id = $2 AND suscripcion_expira_en IS NULL`,
        [dias, restauranteId]
      ).catch(e => console.error('Error auto-setting suscripcion_expira_en:', e));
    }
    
    return {
      plan: restRows[0].plan,
      nombre_plan: planConfig.nombre,
      suscripcion_activa: restRows[0].suscripcion_activa,
      estado: restRows[0].estado,
      expira_en: restRows[0].suscripcion_expira_en,
      dias_restantes: dias_restantes,
      platillos: {
        actuales: currentCount,
        maximo: planConfig.max_platillos,
        disponibles: planConfig.max_platillos - currentCount
      },
      features: planConfig.features
    };
  }
}

module.exports = SubscriptionService;
