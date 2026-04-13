const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'via-passport-idp';
const DEFAULT_AUDIENCE = process.env.JWT_AUDIENCE || 'via-ecosystem';
const ALLOWED_AUDIENCES = (process.env.JWT_ALLOWED_AUDIENCES
  || 'via-ecosystem,mars.daxini.space,orchard.daxini.space,skillhex.daxini.space,logichub.app'
).split(',').map((value) => value.trim()).filter(Boolean);

function generateToken(payload, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiry = options.expiresIn || JWT_EXPIRES_IN;
  const expSeconds = nowSeconds + parseExpiryToSeconds(expiry);
  const audience = options.audience || DEFAULT_AUDIENCE;
  const body = {
    ...payload,
    iss: JWT_ISSUER,
    aud: audience,
    iat: nowSeconds,
    exp: expSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = sign(`${encodedHeader}.${encodedBody}`);
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function verifyToken(token, options = {}) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [encodedHeader, encodedBody, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedBody}`);
  if (!timingSafeEquals(signature, expectedSignature)) throw new Error('Invalid signature');

  const payload = JSON.parse(base64UrlDecode(encodedBody));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const audiences = options.allowedAudiences || ALLOWED_AUDIENCES;
  if (payload.iss !== JWT_ISSUER || !audiences.includes(payload.aud)) throw new Error('Invalid token claims');
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) throw new Error('Token expired');
  return payload;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}
function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}
function sign(input) {
  return crypto.createHmac('sha256', JWT_SECRET).update(input).digest('base64url');
}
function timingSafeEquals(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}
function parseExpiryToSeconds(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 3600;
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 3600;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount * 86400;
}

module.exports = { generateToken, verifyToken };
