import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { tx, get, run } from '../db/index.js';
import { ENV } from '../utils/env.js';
import { signToken } from '../utils/jwt.js';
import { authRequired } from '../middleware/auth.js';
import { generateId, uuid } from '@oc/shared';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: ENV.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  message: { error: 'Too many auth attempts. Try again later.', code: 'RATE_LIMITED' },
});

const usernameRegex = /^[a-zA-Z0-9_]{3,24}$/;

const registerSchema = z.object({
  username: z.string().min(3).max(24).regex(usernameRegex, 'Username must be 3-24 characters, letters, numbers, underscores only'),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const usernameLower = body.username.toLowerCase();
    const emailLower = body.email.toLowerCase();

    const result = await tx((db) => {
      const existing = db.prepare('SELECT id FROM users WHERE username_lower = ? OR email_lower = ?');
      existing.bind([usernameLower, emailLower]);
      const dupe = existing.step() ? existing.getAsObject() : null;
      existing.free();
      if (dupe) {
        const e = new Error('Username or email already in use');
        e.code = 'DUPLICATE';
        throw e;
      }
      const hash = bcrypt.hashSync(body.password, ENV.BCRYPT_ROUNDS);
      const now = Math.floor(Date.now() / 1000);
      const userId = generateId('usr');
      const accId = generateId('acc');
      const insUser = db.prepare(`INSERT INTO users
        (id, username, username_lower, email, email_lower, display_name, password_hash, role, is_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 0, ?, ?)`);
      insUser.bind([userId, body.username, usernameLower, body.email, emailLower,
        body.displayName || body.username, hash, now, now]);
      insUser.step();
      insUser.free();
      const insAcc = db.prepare('INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) VALUES (?, ?, ?, 0, ?)');
      insAcc.bind([accId, 'USER_OC', userId, now]);
      insAcc.step();
      insAcc.free();
      return userId;
    });

    const token = signToken({ sub: result });
    res.cookie(ENV.SESSION_COOKIE, token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const user = get('SELECT id, username, display_name, email, role, is_verified, profile_pic FROM users WHERE id = ?', [result]);
    res.status(201).json({ token, user });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || 'Validation failed', code: 'VALIDATION' });
    if (e?.code === 'DUPLICATE') return res.status(409).json({ error: e.message, code: 'DUPLICATE' });
    next(e);
  }
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const lookup = body.emailOrUsername.toLowerCase();
    const user = get(
      'SELECT * FROM users WHERE email_lower = ? OR username_lower = ?',
      [lookup, lookup],
    );
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'BAD_CREDENTIALS' });
    }
    const ok = bcrypt.compareSync(body.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials', code: 'BAD_CREDENTIALS' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended', code: 'SUSPENDED' });

    const token = signToken({ sub: user.id });
    res.cookie(ENV.SESSION_COOKIE, token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: 'Invalid request', code: 'VALIDATION' });
    next(e);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(ENV.SESSION_COOKIE);
  res.json({ ok: true });
});

router.get('/me', authRequired, (req, res) => {
  const { password_hash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

export default router;
