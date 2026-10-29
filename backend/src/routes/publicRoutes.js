const express = require('express');
const router = express.Router();
const { getPublicMenu, getPublicRecommendations, getGlobalRecommendations } = require('../controllers/menuController');

// POST /api/public/menu/recommendations (Multi-restaurante global ML)
router.post('/recommendations', getGlobalRecommendations);

// GET /api/public/menu/:restaurant_id
router.get('/:restaurant_id', getPublicMenu);

// POST /api/public/menu/:restaurant_id/recommendations
router.post('/:restaurant_id/recommendations', getPublicRecommendations);

module.exports = router;
