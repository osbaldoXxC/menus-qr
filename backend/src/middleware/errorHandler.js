const { logger } = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  logger.error({
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  res.status(err.status || 500).json({
    mensaje: isProduction ? 'Error interno del servidor' : err.message,
    ...(isProduction ? {} : { error: { name: err.name, stack: err.stack } })
  });
};

module.exports = { errorHandler };
