const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({ mensaje: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, rol }
    next();
  } catch (err) {
    res.status(401).json({ mensaje: 'Token no válido o expirado.' });
  }
};

module.exports = authMiddleware;
