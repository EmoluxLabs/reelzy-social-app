import { Router } from 'express';
import { z } from 'zod';
import { tx, get, all } from '../db/index.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { generateId } from '@oc/shared';

const router = Router();

router.use(authRequired, requireRole('super', 'moderator', 'finance', 'support'));

router.get('/stats', (req, res) => {
  const userCount = all('SELECT COUNT(*) AS n FROM users')[0].n;
  const postCount = all('SELECT COUNT(*) AS n FROM posts')[0].n;
  const liveCount = all("SELECT COUNT(*) AS n FROM live_sessions WHERE status = 'live'")[0].n;
  const giftCount = all('SELECT COUNT(*) AS n FROM gift_transactions')[0].n;
  const platformRev = all("SELECT COALESCE(SUM(credit),0) AS oc FROM ledger_entries WHERE op_type = 'GIFT_PLATFORM_CREDIT'")[0].oc;
  const creatorLiab = all("SELECT COALESCE(SUM(balance),0) AS oc FROM ledger_accounts WHERE kind = 'CREATOR_EARNINGS'")[0].oc;
  const userLiab = all("SELECT COALESCE(SUM(balance),0) AS oc FROM ledger_accounts WHERE kind = 'USER_OC'")[0].oc;
  const pendingWd = all("SELECT COUNT(*) AS n FROM obs_withdrawals WHERE status IN ('REQUESTED','RESERVED','APPROVED','BROADCAST')")[0].n;
  res.json({
    users: Number(userCount), posts: Number(postCount), live: Number(liveCount), gifts: Number(giftCount),
    platformRevenueOc: Number(platformRev),
    creatorLiabilityOc: Number(creatorLiab),
    userLiabilityOc: Number(userLiab),
    pendingWithdrawals: Number(pendingWd),
  });
});

router.get('/users', requireRole('super', 'moderator', 'support'), (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = parseInt(req.query.offset) || 0;
  const q = req.query.q ? `%${String(req.query.q).toLowerCase()}%` : null;
  let rows;
  if (q) {
    rows = all(`SELECT id, username, email, display_name, role, is_verified, is_suspended, created_at
      FROM users WHERE username_lower LIKE ? OR email_lower LIKE ? OR display_name LIKE ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?`, [q, q, q, limit, offset]);
  } else {
    rows = all(`SELECT id, username, email, display_name, role, is_verified, is_suspended, created_at
      FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
  }
  res.json({ items: rows });
});

router.post('/users/:id/verify', requireRole('super'), async (req, res, next) => {
  try {
    await tx((db) => {
      db.prepare('UPDATE users SET is_verified = ? WHERE id = ?').run(req.body.verified ? 1 : 0, req.params.id);
      db.prepare('INSERT INTO audit_events (id, actor_id, action, target_type, target_id, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(generateId('aud'), req.user.id, 'verify_user', 'user', req.params.id, JSON.stringify({ verified: !!req.body.verified }), Math.floor(Date.now()/1000));
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/users/:id/suspend', requireRole('super','moderator'), async (req, res, next) => {
  try {
    await tx((db) => {
      db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(req.body.suspended ? 1 : 0, req.params.id);
      db.prepare('INSERT INTO audit_events (id, actor_id, action, target_type, target_id, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(generateId('aud'), req.user.id, 'suspend_user', 'user', req.params.id, JSON.stringify({ suspended: !!req.body.suspended, reason: req.body.reason || '' }), Math.floor(Date.now()/1000));
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/users/:id/role', requireRole('super'), async (req, res, next) => {
  try {
    const role = String(req.body.role || '');
    if (!['user','moderator','support','finance','super'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await tx((db) => {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.get('/reports', requireRole('super','moderator','support'), (req, res) => {
  const status = req.query.status || 'open';
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const rows = all(`SELECT r.*, u.username AS reporter_username FROM reports r JOIN users u ON u.id = r.reporter_id
    WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ?`, [status, limit]);
  res.json({ items: rows });
});

router.post('/reports/:id/resolve', requireRole('super','moderator'), async (req, res, next) => {
  try {
    await tx((db) => {
      db.prepare('UPDATE reports SET status = ?, moderator_id = ?, action = ?, resolved_at = ? WHERE id = ?')
        .run(req.body.status || 'reviewed', req.user.id, req.body.action || null, Math.floor(Date.now()/1000), req.params.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/reports', authRequired, async (req, res, next) => {
  try {
    const body = z.object({
      targetType: z.enum(['user','post','comment','live','message']),
      targetId: z.string().min(1),
      reason: z.string().min(1).max(500),
      detail: z.string().max(2000).optional(),
    }).parse(req.body);
    const id = generateId('rep');
    await tx((db) => {
      db.prepare(`INSERT INTO reports (id, reporter_id, target_type, target_id, reason, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.user.id, body.targetType, body.targetId, body.reason, body.detail || '', Math.floor(Date.now()/1000));
    });
    res.status(201).json({ ok: true, id });
  } catch(e){
    if (e?.issues) return res.status(400).json({ error: 'Validation failed' });
    next(e);
  }
});

// Withdrawals list
router.get('/withdrawals', requireRole('super','finance'), (req, res) => {
  const status = req.query.status || 'REQUESTED';
  const rows = all(`SELECT w.*, u.username, u.display_name, u.email FROM obs_withdrawals w JOIN users u ON u.id = w.user_id
    WHERE w.status = ? ORDER BY w.created_at DESC LIMIT 100`, [status]);
  res.json({ items: rows });
});

router.post('/withdrawals/:id/approve', requireRole('super','finance'), async (req, res, next) => {
  try {
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE obs_withdrawals SET status = 'APPROVED', reviewer_id = ? WHERE id = ? AND status = 'REQUESTED'")
        .run(req.user.id, req.params.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

// Reconciliation snapshot
router.get('/reconciliation', requireRole('super','finance'), (req, res) => {
  const rows = all(`SELECT kind, SUM(balance) AS total FROM ledger_accounts GROUP BY kind`);
  const obsDeposits = all(`SELECT status, COUNT(*) AS n, COALESCE(SUM(expected_oc),0) AS oc FROM obs_deposits GROUP BY status`);
  const wds = all(`SELECT status, COUNT(*) AS n, COALESCE(SUM(amount_oc),0) AS oc FROM obs_withdrawals GROUP BY status`);
  res.json({ accounts: rows, deposits: obsDeposits, withdrawals: wds });
});

export default router;
