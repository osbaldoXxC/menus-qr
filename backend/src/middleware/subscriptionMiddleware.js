const db = require('../config/db');
const SubscriptionService = require('../services/subscriptionService');

const subscriptionMiddleware = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Obtener estado de suscripción del usuario
    const result = await db.query(
      `SELECT suscripcion_activa, estado, suscripcion_expira_en
       FROM restaurantes
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    const user = result.rows[0];

    // Verificar si la suscripción está activa
    if (!user.suscripcion_activa) {
      const msg = user.estado === 'pendiente'
        ? 'Tu cuenta está en espera de aprobación por el Super Admin.'
        : 'Tu suscripción ha sido cancelada o suspendida.';
      return res.status(403).json({ mensaje: msg });
    }

    // Verificar si la suscripción ha expirado
    if (user.suscripcion_expira_en && new Date(user.suscripcion_expira_en) < new Date()) {
      return res.status(403).json({ mensaje: 'Tu suscripción ha expirado. Contacta al administrador para renovarla.' });
    }

    next();
  } catch (error) {
    console.error('Error en subscriptionMiddleware:', error);
    res.status(500).json({ mensaje: 'Error al verificar suscripción' });
  }
};

const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const hasAccess = await SubscriptionService.hasFeature(userId, featureKey);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          mensaje: `Tu plan actual no incluye la funcionalidad: ${featureKey}. Actualiza a Premium para disfrutar de más beneficios.` 
        });
      }
      
      next();
    } catch (error) {
      console.error(`Error verificando feature ${featureKey}:`, error);
      res.status(500).json({ mensaje: 'Error al verificar permisos' });
    }
  };
};

module.exports = {
  subscriptionMiddleware,
  requireFeature
};
