import { verifyToken } from '../utils/jwt.js';
import { get } from '../db/index.js';

const WHITE_LIST = new Set(['super', 'finance', 'support', 'moderator', 'user']);

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.oc_session;
  if (!token) return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session', code: 'BAD_TOKEN' });
  const user = get('SELECT id, username, display_name, email, email_lower, role, is_verified, is_suspended, profile_pic FROM users WHERE id = ?', [payload.sub]);
  if (!user) return res.status(401).json({ error: 'Account not found', code: 'NO_USER' });
  if (user.is_suspended) return res.status(403).json({ error: 'Account suspended', code: 'SUSPENDED' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
    next();
  };
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.oc_session;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = get('SELECT id, username, display_name, email, role, is_verified, is_suspended, profile_pic FROM users WHERE id = ?', [payload.sub]);
      if (user && !user.is_suspended) req.user = user;
    }
  }
  next();
}
