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

function verifyPassportToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header.' });
  }
  try {
    const payload = verifyToken(token, {
      allowedAudiences: ['via-ecosystem', 'mars.daxini.space', 'orchard.daxini.space', 'skillhex.daxini.space', 'logichub.app'],
    });
    req.passportUser = {
      uid: payload.uid,
      passport_id: payload.passport_id,
      entitlements: payload.entitlements || [],
      audience: payload.aud,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired passport token.' });
  }
}

module.exports = { authGuard, verifyPassportToken };
