const express = require('express');
const router = express.Router();
const { getPublicMenu, getPublicRecommendations, getGlobalRecommendations } = require('../controllers/menuController');
const { comensalRecommenderGuard } = require('../middleware/comensalRecommenderGuard');

// POST /api/public/menu/recommendations (y alias /api/public/recommendations) — Protegido por sesión COMENSAL y cuota 5/semana
router.post('/recommendations', comensalRecommenderGuard, getGlobalRecommendations);

// GET /api/public/menu/:restaurant_id — Lectura pública del menú QR (permanece pública sin sesión)
router.get('/:restaurant_id', getPublicMenu);

// POST /api/public/menu/:restaurant_id/recommendations (y alias /api/public/:restaurant_id/recommendations) — Protegido por sesión COMENSAL y cuota 5/semana
router.post('/:restaurant_id/recommendations', comensalRecommenderGuard, getPublicRecommendations);

module.exports = router;
