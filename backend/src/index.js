const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.RESTAURANTE_URL,
  process.env.ADMIN_URL,
  'https://app.oamdevsol.site',
  'https://panel.oamdevsol.site',
  'https://backend.oamdevsol.site',
  'https://cdn.oamdevsol.site',
  'https://mexxicanmx.oamdevsol.site',
  'https://admin.oamdevsol.site',
  'https://oamdevsol.site',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", process.env.CLOUDFRONT_DOMAIN || '*', process.env.BACKEND_URL || '*'],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", process.env.BACKEND_URL || '*'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: process.env.NODE_ENV === 'production'
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  hidePoweredBy: true,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir orígenes sin definir (ej. herramientas como Postman) o si están en la lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('Bloqueado por CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24 horas
}));

app.use(express.json());
app.use(cookieParser());

// Rate Limiting
const restaurantLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // 1000 peticiones por minuto para restaurantes y admin
  message: { mensaje: 'Límite de peticiones de restaurante excedido (máximo 1000 por minuto)' }
});

const publicMenuLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 peticiones máximo por 15 minutos para menú público
  message: { mensaje: 'Límite de consultas al menú público alcanzado (máximo 100 por 15 minutos)' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { mensaje: 'Demasiados intentos de autenticación, bloqueado por 15 minutos' }
});

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 200,
  message: { mensaje: 'Límite de mensajes de soporte excedido' }
});

// Logger de peticiones para depuración
app.use((req, res, next) => {
  if (process.env.DEBUG_REQUESTS === 'true') {
    console.log(`[REQUEST] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  }
  next();
});

// Servir archivos estáticos (Imágenes subidas localmente)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Database and Redis connections
const dbConfig = require('./config/db');
require('./config/redis');

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', require('./routes/authRoutes'));

app.use('/api/menu', restaurantLimiter, require('./routes/menuRoutes'));
app.use('/api/categories', restaurantLimiter, require('./routes/categoryRoutes'));
app.use('/api/restaurants', restaurantLimiter, require('./routes/restaurantRoutes'));
app.use('/api/admin', restaurantLimiter, require('./routes/adminRoutes'));
app.use('/api/public/menu', publicMenuLimiter, require('./routes/publicRoutes'));
app.use('/api/public', publicMenuLimiter, require('./routes/publicRoutes'));
app.use('/api/search', restaurantLimiter, require('./routes/searchRoutes'));
app.use('/api/support', supportLimiter, require('./routes/supportRoutes'));

app.get('/', (req, res) => {
  res.json({ message: 'MexxicanMX Backend API is running' });
});

app.get('/health', async (req, res) => {
  try {
    const dbRes = await dbConfig.query('SELECT 1 as healthy');
    res.json({
      status: 'UP',
      service: 'MexxicanMX API',
      database: dbRes.rows[0].healthy === 1 ? 'connected' : 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
