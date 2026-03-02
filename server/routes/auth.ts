import { Router } from 'express';
import crypto from 'crypto';
import db from '../db';

const router = Router();

const SESSION_MAX_AGE_DAYS = 30;

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  const authPassword = process.env.AUTH_PASSWORD;

  // AUTH_PASSWORD が未設定なら認証スキップ（ローカル開発用）
  if (!authPassword) {
    res.json({ ok: true, message: 'Auth disabled (no AUTH_PASSWORD set)' });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const pwBuffer = Buffer.from(password);
  const authBuffer = Buffer.from(authPassword);
  if (pwBuffer.length !== authBuffer.length || !crypto.timingSafeEqual(pwBuffer, authBuffer)) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO auth_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);

  // Set httpOnly cookie
  res.cookie('techo_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ ok: true });
});

// GET /api/auth/check
router.get('/check', (req, res) => {
  const authPassword = process.env.AUTH_PASSWORD;

  // AUTH_PASSWORD が未設定なら認証不要
  if (!authPassword) {
    res.json({ authenticated: true, authDisabled: true });
    return;
  }

  const token = req.cookies?.techo_session;
  if (!token) {
    res.status(401).json({ authenticated: false });
    return;
  }

  const session = db.prepare(
    'SELECT * FROM auth_sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  ).get(token);

  if (!session) {
    res.clearCookie('techo_session', { path: '/' });
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.techo_session;
  if (token) {
    db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
  }
  res.clearCookie('techo_session', { path: '/' });
  res.json({ ok: true });
});

// Cleanup expired sessions (run periodically)
export function cleanupExpiredSessions() {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= datetime(\'now\')').run();
}

export default router;
