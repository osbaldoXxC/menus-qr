const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  register, 
  login, 
  verifyEmail, 
  resendVerification, 
  forgotPassword, 
  resetPassword,
  refresh,
  logout
} = require('../controllers/authController');
const {
  registerComensal,
  loginComensal,
  refreshComensal,
  logoutComensal,
  getComensalMe,
  forgotComensalPassword,
  resetComensalPassword
} = require('../controllers/comensalAuthController');

// OWASP A07: Limitador de tasa para endpoints de autenticación y OTP
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // Máximo 5 peticiones por minuto por IP
  message: { mensaje: 'Demasiadas peticiones. Por favor, intenta de nuevo en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rutas de Restaurantes y Super Admin (Existentes — Intactas)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);

// Rutas de Autenticación y Cuota para Rol COMENSAL (Issue #43)
router.post('/comensal/register', authLimiter, registerComensal);
router.post('/comensal/login', authLimiter, loginComensal);
router.post('/comensal/refresh', authLimiter, refreshComensal);
router.post('/comensal/logout', logoutComensal);
router.get('/comensal/me', getComensalMe);
router.get('/comensal/quota/:userId?', getComensalMe);
router.post('/comensal/forgot-password', authLimiter, forgotComensalPassword);
router.post('/comensal/reset-password', authLimiter, resetComensalPassword);

module.exports = router;
