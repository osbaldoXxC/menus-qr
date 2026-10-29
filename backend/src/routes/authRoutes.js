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

// OWASP A07: Limitador de tasa para endpoints de autenticación y OTP
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // Máximo 5 peticiones por minuto por IP
  message: { mensaje: 'Demasiadas peticiones. Por favor, intenta de nuevo en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/register
router.post('/register', authLimiter, register);

// POST /api/auth/login
router.post('/login', authLimiter, login);

// POST /api/auth/verify-email
router.post('/verify-email', authLimiter, verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, resendVerification);

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, resetPassword);

// POST /api/auth/refresh
router.post('/refresh', authLimiter, refresh);

// POST /api/auth/logout
router.post('/logout', logout); // Logout no requiere rate limit agresivo, pero limpia tokens

module.exports = router;
