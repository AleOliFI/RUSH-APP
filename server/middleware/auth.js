// ============================================================
// RUSH PERFORMANCE — Auth Middleware
// ============================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rush_performance_secret_key_change_in_production';
const JWT_EXPIRES_IN = '24h';
const JWT_REFRESH_EXPIRES_IN = '30d';

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, academy_id: user.academy_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Auth middleware — verifies JWT token
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Role-based authorization
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este recurso' });
    }
    next();
  };
}

/**
 * Optional auth — doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      req.user = null;
    }
  }
  next();
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticate,
  authorize,
  optionalAuth,
  JWT_SECRET,
};
