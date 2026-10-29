const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Ruta para encontrar matches de platillos
router.post('/matches', searchController.findMatches);

module.exports = router;
