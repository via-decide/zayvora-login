const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const bcrypt = require('bcrypt');

const { generateToken } = require('./auth/jwt_manager.cjs');
const { authGuard, verifyPassportToken } = require('./auth/auth_guard.cjs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_DIR = path.join(__dirname, 'database');
const DB_PATH = path.join(DB_DIR, 'users.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function sqliteExec(sql, params = []) {
  const escapedParams = params.map((value) => `'${String(value).replace(/'/g, "''")}'`);
  const statement = escapedParams.reduce((acc, value) => acc.replace('?', value), sql);
  return execFileSync('sqlite3', [DB_PATH, statement], { encoding: 'utf8' }).trim();
}

function ensureDatabase() {
  sqliteExec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqliteExec(`
    CREATE TABLE IF NOT EXISTS early_access_applications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      team_size TEXT NOT NULL,
      use_case TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      access_token TEXT,
      access_token_expires TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at TEXT
    );
  `);

  sqliteExec(`
    CREATE TABLE IF NOT EXISTS passport_users (
      uid TEXT PRIMARY KEY,
      passport_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      public_key TEXT,
      pin_hash TEXT NOT NULL,
      skill_matrix TEXT NOT NULL DEFAULT '{}',
      entitlements TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  next();
}

function corsMiddleware(req, res, next) {
  const allowedOrigins = (process.env.CORS_ORIGINS
    || 'https://mars.daxini.space,https://orchard.daxini.space,https://skillhex.daxini.space,https://logichub.app,http://localhost:3000'
  ).split(',').map((value) => value.trim());
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
}

const rateBuckets = new Map();
function authRateLimit(req, res, next) {
  const windowMs = 15 * 60 * 1000;
  const max = 10;
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();

  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (bucket.count > max) {
    return res.status(429).json({ message: 'Too many authentication attempts. Try again later.' });
  }

  next();
}

function isValidUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_.@-]{3,64}$/.test(username.trim());
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 10 && password.length <= 128;
}

function parseJsonColumn(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

ensureDatabase();
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '16kb' }));
app.use(express.static(__dirname));

// Route for early access landing page
app.get('/early-access', (req, res) => {
  res.sendFile(path.join(__dirname, 'early-access.html'));
});

app.get('/tap', (req, res) => {
  res.sendFile(path.join(__dirname, 'tap.html'));
});

app.post('/auth/register', authRateLimit, async (req, res) => {
  const { username, password } = req.body;

  if (!isValidUsername(username)) {
    return res.status(400).json({ message: 'Invalid username format.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ message: 'Password must be 10-128 characters.' });
  }

  try {
    const normalizedUsername = username.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    sqliteExec('INSERT INTO users (username, password_hash) VALUES (?, ?);', [normalizedUsername, passwordHash]);

    const row = sqliteExec('SELECT id, username FROM users WHERE username = ?;', [normalizedUsername]);
    const [id, storedUsername] = row.split('|');

    return res.status(201).json({
      message: 'User registered successfully.',
      user: { id: Number(id), username: storedUsername },
    });
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Unable to register user.' });
  }
});

app.post('/auth/login', authRateLimit, async (req, res) => {
  const { username, password } = req.body;

  if (!isValidUsername(username) || !isValidPassword(password)) {
    return res.status(400).json({ message: 'Invalid credentials format.' });
  }

  try {
    const normalizedUsername = username.trim().toLowerCase();
    const row = sqliteExec('SELECT id, username, password_hash FROM users WHERE username = ?;', [normalizedUsername]);
    if (!row) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const [id, storedUsername, storedHash] = row.split('|');
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = generateToken({ userId: Number(id), username: storedUsername });

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: Number(id), username: storedUsername },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Unable to login.' });
  }
});

app.post('/auth/logout', authGuard, (req, res) => {
  res.status(200).json({ message: 'Logout successful. Discard the token client-side.' });
});

app.get('/auth/verify', authGuard, (req, res) => {
  res.status(200).json({ valid: true, user: req.authUser });
});

app.post('/api/passport/login', authRateLimit, async (req, res) => {
  const { passport_id, pin } = req.body || {};
  if (typeof passport_id !== 'string' || typeof pin !== 'string' || pin.length < 4) {
    return res.status(400).json({ message: 'passport_id and pin are required.' });
  }

  try {
    const row = sqliteExec(
      'SELECT uid, passport_id, pin_hash, entitlements FROM passport_users WHERE passport_id = ?;',
      [passport_id.trim()]
    );
    if (!row) {
      return res.status(401).json({ message: 'Invalid passport_id or pin.' });
    }

    const [uid, storedPassportId, pinHash, entitlementsRaw] = row.split('|');
    const pinMatches = await bcrypt.compare(pin, pinHash);
    if (!pinMatches) {
      return res.status(401).json({ message: 'Invalid passport_id or pin.' });
    }

    const entitlements = parseJsonColumn(entitlementsRaw, []);
    const token = generateToken({ uid, passport_id: storedPassportId, entitlements }, { audience: 'via-ecosystem' });

    return res.status(200).json({ token, uid, passport_id: storedPassportId, entitlements });
  } catch (error) {
    console.error('Passport login error:', error);
    return res.status(500).json({ message: 'Unable to login with passport.' });
  }
});

app.get('/api/passport/profile', verifyPassportToken, (req, res) => {
  try {
    const row = sqliteExec(
      'SELECT uid, skill_matrix, entitlements FROM passport_users WHERE uid = ?;',
      [req.passportUser.uid]
    );
    if (!row) {
      return res.status(404).json({ message: 'Passport profile not found.' });
    }
    const [uid, skillMatrixRaw, entitlementsRaw] = row.split('|');
    return res.status(200).json({
      uid,
      skill_matrix: parseJsonColumn(skillMatrixRaw, {}),
      entitlements: parseJsonColumn(entitlementsRaw, []),
    });
  } catch (error) {
    console.error('Passport profile error:', error);
    return res.status(500).json({ message: 'Unable to fetch passport profile.' });
  }
});

app.post('/api/passport/nfc-login', authRateLimit, async (req, res) => {
  const { passport_id, pin } = req.body || {};
  if (typeof passport_id !== 'string' || typeof pin !== 'string' || pin.length < 4) {
    return res.status(400).json({ message: 'passport_id and pin are required for NFC login.' });
  }

  try {
    const row = sqliteExec(
      'SELECT uid, passport_id, pin_hash, entitlements FROM passport_users WHERE passport_id = ?;',
      [passport_id.trim()]
    );
    if (!row) {
      return res.status(401).json({ message: 'Invalid passport_id or pin.' });
    }

    const [uid, storedPassportId, pinHash, entitlementsRaw] = row.split('|');
    const pinMatches = await bcrypt.compare(pin, pinHash);
    if (!pinMatches) {
      return res.status(401).json({ message: 'Invalid passport_id or pin.' });
    }

    const entitlements = parseJsonColumn(entitlementsRaw, []);
    const token = generateToken(
      { uid, passport_id: storedPassportId, entitlements, auth_method: 'nfc' },
      { audience: 'via-ecosystem' }
    );

    return res.status(200).json({ token, uid, passport_id: storedPassportId, entitlements, auth_method: 'nfc' });
  } catch (error) {
    console.error('Passport NFC login error:', error);
    return res.status(500).json({ message: 'Unable to perform NFC login.' });
  }
});


app.post('/passport/verify', authRateLimit, (req, res) => {
  const { uid } = req.body || {};
  if (typeof uid !== 'string' || uid.trim().length === 0) {
    return res.status(400).json({ message: 'uid is required.' });
  }

  try {
    const row = sqliteExec(
      'SELECT uid, passport_id, entitlements FROM passport_users WHERE uid = ?;',
      [uid.trim()]
    );
    if (!row) {
      return res.status(401).json({ message: 'Passport not recognized.' });
    }

    const [storedUid, passportId, entitlementsRaw] = row.split('|');
    const entitlements = parseJsonColumn(entitlementsRaw, []);
    const token = generateToken(
      { uid: storedUid, passport_id: passportId, entitlements, auth_method: 'nfc_uid' },
      { audience: 'via-ecosystem' }
    );

    return res.status(200).json({
      message: 'Passport verified.',
      token,
      uid: storedUid,
      passport_id: passportId,
      entitlements,
    });
  } catch (error) {
    console.error('Passport verify error:', error);
    return res.status(500).json({ message: 'Unable to verify passport.' });
  }
});

app.post('/passport/logout', verifyPassportToken, (req, res) => {
  return res.status(200).json({
    message: 'Passport session ended. Remove token on the client.',
    uid: req.passportUser.uid,
  });
});

app.post('/api/commands', authGuard, (req, res) => {
  const { command } = req.body;
  if (typeof command !== 'string' || command.trim().length === 0) {
    return res.status(400).json({ message: 'Command is required.' });
  }

  return res.status(200).json({
    message: 'Command accepted by Zayvora gateway.',
    executedBy: req.authUser.username,
    requestId: crypto.randomUUID(),
    command: command.trim(),
  });
});

// Early Access Application Endpoints
app.post('/api/early-access/apply', async (req, res) => {
  const { email, company, team_size, use_case } = req.body;

  // Validation
  if (!email || !company || !team_size || !use_case) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ message: 'Invalid email address.' });
  }

  if (company.trim().length < 2 || company.trim().length > 100) {
    return res.status(400).json({ message: 'Company name must be 2-100 characters.' });
  }

  if (use_case.trim().length < 10 || use_case.trim().length > 500) {
    return res.status(400).json({ message: 'Use case must be 10-500 characters.' });
  }

  try {
    const applicationId = crypto.randomUUID();
    const normalizedEmail = email.trim().toLowerCase();

    sqliteExec(
      'INSERT INTO early_access_applications (id, email, company, team_size, use_case, status) VALUES (?, ?, ?, ?, ?, ?);',
      [applicationId, normalizedEmail, company.trim(), team_size, use_case.trim(), 'pending']
    );

    console.log(`[Zayvora-EarlyAccess] New application: ${normalizedEmail} (${applicationId})`);

    return res.status(201).json({
      message: 'Application submitted successfully. You will receive a decision email within 24 hours.',
      application_id: applicationId,
    });
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'This email has already applied for early access.' });
    }
    console.error('Early access application error:', error);
    return res.status(500).json({ message: 'Unable to process application.' });
  }
});

app.get('/api/early-access/status/:email', (req, res) => {
  const { email } = req.params;

  if (!email || email.trim().length === 0) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const row = sqliteExec('SELECT id, email, company, status, access_token, created_at FROM early_access_applications WHERE email = ?;', [normalizedEmail]);

    if (!row) {
      return res.status(404).json({ message: 'No application found for this email.' });
    }

    const [id, storedEmail, company, status, accessToken, createdAt] = row.split('|');

    return res.status(200).json({
      application_id: id,
      email: storedEmail,
      company,
      status,
      access_token: status === 'approved' ? accessToken : null,
      created_at: createdAt,
    });
  } catch (error) {
    console.error('Early access status error:', error);
    return res.status(500).json({ message: 'Unable to fetch application status.' });
  }
});

app.post('/api/early-access/admin/approve', (req, res) => {
  const { email, admin_key } = req.body;

  // Simple admin key check (use env variable in production)
  const adminKey = process.env.ZAYVORA_ADMIN_KEY || 'dev-admin-key-change-in-production';
  if (admin_key !== adminKey) {
    return res.status(403).json({ message: 'Unauthorized.' });
  }

  if (!email || email.trim().length === 0) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const accessToken = `zayvora_ea_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

    sqliteExec(
      'UPDATE early_access_applications SET status = ?, access_token = ?, access_token_expires = ?, approved_at = CURRENT_TIMESTAMP WHERE email = ?;',
      ['approved', accessToken, expiresAt, normalizedEmail]
    );

    console.log(`[Zayvora-EarlyAccess-Admin] Application approved: ${normalizedEmail}`);

    return res.status(200).json({
      message: 'Application approved successfully.',
      access_token: accessToken,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Early access approval error:', error);
    return res.status(500).json({ message: 'Unable to approve application.' });
  }
});

app.post('/api/early-access/admin/reject', (req, res) => {
  const { email, admin_key, reason } = req.body;

  const adminKey = process.env.ZAYVORA_ADMIN_KEY || 'dev-admin-key-change-in-production';
  if (admin_key !== adminKey) {
    return res.status(403).json({ message: 'Unauthorized.' });
  }

  if (!email || email.trim().length === 0) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    sqliteExec(
      'UPDATE early_access_applications SET status = ? WHERE email = ?;',
      ['rejected', normalizedEmail]
    );

    console.log(`[Zayvora-EarlyAccess-Admin] Application rejected: ${normalizedEmail} (reason: ${reason || 'none'})`);

    return res.status(200).json({ message: 'Application rejected.' });
  } catch (error) {
    console.error('Early access rejection error:', error);
    return res.status(500).json({ message: 'Unable to reject application.' });
  }
});

app.get('/api/early-access/admin/pending', (req, res) => {
  const { admin_key } = req.query;

  const adminKey = process.env.ZAYVORA_ADMIN_KEY || 'dev-admin-key-change-in-production';
  if (admin_key !== adminKey) {
    return res.status(403).json({ message: 'Unauthorized.' });
  }

  try {
    const result = sqliteExec('SELECT id, email, company, team_size, use_case, created_at FROM early_access_applications WHERE status = ? ORDER BY created_at DESC;', ['pending']);

    if (!result) {
      return res.status(200).json({ applications: [] });
    }

    const applications = result.split('\n').map(row => {
      const [id, email, company, team_size, use_case, createdAt] = row.split('|');
      return { id, email, company, team_size, use_case, created_at: createdAt };
    });

    return res.status(200).json({ applications, count: applications.length });
  } catch (error) {
    console.error('Early access admin error:', error);
    return res.status(500).json({ message: 'Unable to fetch pending applications.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zayvora auth gateway running on port ${PORT}`);
});
