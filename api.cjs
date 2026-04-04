const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const bcrypt = require('bcrypt');

const { generateToken } = require('./auth/jwt_manager.cjs');
const { authGuard } = require('./auth/auth_guard.cjs');

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
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  next();
}

function corsMiddleware(req, res, next) {
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
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

ensureDatabase();
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '16kb' }));
app.use(express.static(__dirname));

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

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zayvora auth gateway running on port ${PORT}`);
});
