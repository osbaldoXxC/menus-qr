const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const {
  streamConversations,
  getMisConversaciones,
  sendMessageRestaurante,
  rateConversacion,
  getConversationsAdmin,
  getConversationMessagesAdmin,
  aceptarConversacion,
  sendMessageAdmin,
  closeConversation,
  getDashboardAdmin
} = require('../controllers/supportController');

// Ruta para eventos SSE en tiempo real
router.get('/stream', authMiddleware, streamConversations);

// Rutas para Restaurantes
router.get('/my-conversations', authMiddleware, roleMiddleware(['RESTAURANTE']), getMisConversaciones);
router.post('/my-conversations/messages', authMiddleware, roleMiddleware(['RESTAURANTE']), sendMessageRestaurante);
router.post('/my-conversations/:conversacion_id/rate', authMiddleware, roleMiddleware(['RESTAURANTE']), rateConversacion);

// Rutas para Admins (Soporte)
router.get('/admin/dashboard', authMiddleware, roleMiddleware(['SUPER_ADMIN']), getDashboardAdmin);
router.get('/admin/conversaciones', authMiddleware, roleMiddleware(['SUPER_ADMIN']), getConversationsAdmin);
router.get('/admin/conversacion/:conversacion_id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), getConversationMessagesAdmin);
router.post('/admin/conversacion/:conversacion_id/aceptar', authMiddleware, roleMiddleware(['SUPER_ADMIN']), aceptarConversacion);
router.post('/admin/conversacion/:conversacion_id/mensaje', authMiddleware, roleMiddleware(['SUPER_ADMIN']), sendMessageAdmin);
router.post('/admin/conversacion/:conversacion_id/cerrar', authMiddleware, roleMiddleware(['SUPER_ADMIN']), closeConversation);

module.exports = router;
