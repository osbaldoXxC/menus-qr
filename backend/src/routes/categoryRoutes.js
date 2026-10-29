const express = require('express');
const router = express.Router();
const { 
  createCategory, 
  getCategories, 
  updateCategory, 
  deleteCategory, 
  reorderCategories 
} = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Prefijo: /api/categories
// Todos requieren autenticación y rol de Restaurante o Admin

router.use(authMiddleware);
router.use(roleMiddleware(['RESTAURANTE', 'SUPER_ADMIN']));

router.get('/', getCategories);
router.post('/', createCategory);
router.put('/orden', reorderCategories);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
