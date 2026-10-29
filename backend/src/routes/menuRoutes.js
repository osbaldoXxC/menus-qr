const express = require('express');
const router = express.Router();
const {
  createDish,
  getDishes,
  updateDish,
  deleteDish
} = require('../controllers/menuController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { subscriptionMiddleware } = require('../middleware/subscriptionMiddleware');
const { upload, optimizeImage } = require('../middleware/uploadMiddleware');

// Aplicar middleware de autenticación a todas las rutas del menú
router.use(authMiddleware);
router.use(roleMiddleware(['RESTAURANTE', 'SUPER_ADMIN']));
router.use(subscriptionMiddleware);

// GET /api/menu/platillos
router.get('/platillos', getDishes);

// POST /api/menu/platillos
router.post('/platillos', 
  upload.single('imagen'), 
  optimizeImage,
  createDish
);

// PUT /api/menu/platillos/:id
router.put('/platillos/:id', 
  upload.single('imagen'), 
  optimizeImage,
  updateDish
);

// DELETE /api/menu/platillos/:id
router.delete('/platillos/:id', deleteDish);

module.exports = router;
