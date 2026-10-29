const express = require('express');
const router = express.Router();
const { generateQR, updateTheme, getRestaurantInfo, uploadBrandingImage } = require('../controllers/restaurantController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { subscriptionMiddleware } = require('../middleware/subscriptionMiddleware');
const { upload, optimizeImage } = require('../middleware/uploadMiddleware');

// GET /api/restaurants/info
router.get('/info', authMiddleware, roleMiddleware(['RESTAURANTE', 'SUPER_ADMIN']), subscriptionMiddleware, getRestaurantInfo);

// GET /api/restaurants/qr
// Solo accesible por Restaurantes autenticados
router.get('/qr', authMiddleware, roleMiddleware(['RESTAURANTE', 'SUPER_ADMIN']), subscriptionMiddleware, generateQR);

// PUT /api/restaurants/theme
// Solo accesible por Restaurantes autenticados (Premium)
router.put('/theme', authMiddleware, roleMiddleware(['RESTAURANTE', 'SUPER_ADMIN']), subscriptionMiddleware, updateTheme);

// POST /api/restaurants/upload-branding
// Para subir logotipos o banners
router.post('/upload-branding',
  authMiddleware,
  roleMiddleware(['RESTAURANTE', 'SUPER_ADMIN']),
  subscriptionMiddleware,
  upload.single('imagen'),
  optimizeImage,
  uploadBrandingImage
);

module.exports = router;
