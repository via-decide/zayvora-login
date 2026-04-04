const { verifyToken } = require('./jwt_manager.cjs');

function authGuard(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header.' });
  }
  try {
    const payload = verifyToken(token);
    req.authUser = { userId: payload.userId, username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { authGuard };
