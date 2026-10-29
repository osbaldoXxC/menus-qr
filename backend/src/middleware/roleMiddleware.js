const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.map(r => r.toUpperCase()).includes(req.user.rol.toUpperCase())) {
      return res.status(403).json({ mensaje: 'Acceso prohibido: permisos insuficientes.' });
    }
    next();
  };
};

module.exports = roleMiddleware;
