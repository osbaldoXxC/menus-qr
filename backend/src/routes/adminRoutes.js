const express = require('express');
const router = express.Router();
const { 
  getAllRestaurants, 
  approveRestaurant, 
  cancelRestaurantAccess, 
  updateRestaurantStatus,
  getAuditHistory
} = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Todas las rutas requieren SUPER_ADMIN
router.use(authMiddleware);
router.use(roleMiddleware(['SUPER_ADMIN']));

// GET /api/admin/restaurants
router.get('/restaurants', getAllRestaurants);

// PUT /api/admin/restaurants/:id/approve
router.put('/restaurants/:id/approve', approveRestaurant);

// PUT /api/admin/restaurants/:id/cancel (alias para suspend)
router.put('/restaurants/:id/cancel', cancelRestaurantAccess);

// PUT /api/admin/restaurants/:id/suspend (Kill Switch)
router.put('/restaurants/:id/suspend', cancelRestaurantAccess);

// PUT /api/admin/restaurants/:id/status
router.put('/restaurants/:id/status', updateRestaurantStatus);

// GET /api/admin/restaurants/:id/audit
router.get('/restaurants/:id/audit', getAuditHistory);

module.exports = router;
