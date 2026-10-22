import { Router } from 'express';
import { z } from 'zod';
import { tx, get, all, run } from '../db/index.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { generateId } from '@oc/shared';
import { notify } from '../services/notifications.js';
import { getOrCreateUserAccount } from '../services/ledger.js';

const router = Router();

// Public profile lookup
router.get('/:id', optionalAuth, (req, res) => {
  const u = get(`SELECT id, username, display_name, bio, website, profile_pic, cover_pic,
    is_verified, followers_count, following_count, created_at, is_private, role
    FROM users WHERE id = ? OR username_lower = ?`, [req.params.id, req.params.id.toLowerCase()]);
  if (!u) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  // Hide email and private fields
  const viewerId = req.user?.id;
  let isFollowing = false;
  if (viewerId) {
    const f = get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', [viewerId, u.id]);
    isFollowing = !!f;
  }
  // If private and not following (and not self), hide sensitive fields
  if (u.is_private && !isFollowing && viewerId !== u.id) {
    return res.json({ ...u, bio: '', website: '', is_private_viewer: true, is_following: isFollowing });
  }
  res.json({ ...u, is_following: isFollowing });
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(300).optional(),
  website: z.string().max(200).optional().nullable(),
  profilePic: z.string().max(500).optional().nullable(),
  coverPic: z.string().max(500).optional().nullable(),
  isPrivate: z.boolean().optional(),
});

router.patch('/me', authRequired, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const now = Math.floor(Date.now() / 1000);
    await tx((db) => {
      const fields = [];
      const params = [];
      if (body.displayName !== undefined) { fields.push('display_name = ?'); params.push(body.displayName); }
      if (body.bio !== undefined) { fields.push('bio = ?'); params.push(body.bio); }
      if (body.website !== undefined) { fields.push('website = ?'); params.push(body.website || ''); }
      if (body.profilePic !== undefined) { fields.push('profile_pic = ?'); params.push(body.profilePic || ''); }
      if (body.coverPic !== undefined) { fields.push('cover_pic = ?'); params.push(body.coverPic || ''); }
      if (body.isPrivate !== undefined) { fields.push('is_private = ?'); params.push(body.isPrivate ? 1 : 0); }
      if (!fields.length) return;
      fields.push('updated_at = ?');
      params.push(now);
      params.push(req.user.id);
      const s = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
      s.run(...params);
      s.free();
    });
    const u = get('SELECT id, username, display_name, email, bio, website, profile_pic, cover_pic, is_verified, role, is_private FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: u });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION' });
    next(e);
  }
});

// Follow/unfollow
router.post('/:id/follow', authRequired, async (req, res, next) => {
  try {
    const target = get('SELECT id FROM users WHERE id = ? OR username_lower = ?', [req.params.id, req.params.id.toLowerCase()]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
    let followed = false;
    await tx((db) => {
      const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?');
      existing.bind([req.user.id, target.id]);
      const already = existing.step();
      existing.free();
      if (already) return;
      const ins = db.prepare('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)');
      ins.run(req.user.id, target.id, Math.floor(Date.now() / 1000));
      ins.free();
      db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.user.id);
      db.prepare('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?').run(target.id);
      followed = true;
    });
    if (followed) notify({ userId: target.id, type: 'follow', actorId: req.user.id, payload: {} }).catch(() => {});
    res.json({ ok: true, following: true });
  } catch (e) { next(e); }
});

router.post('/:id/unfollow', authRequired, async (req, res, next) => {
  try {
    const target = get('SELECT id FROM users WHERE id = ? OR username_lower = ?', [req.params.id, req.params.id.toLowerCase()]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    await tx((db) => {
      const del = db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?');
      const info = del.run(req.user.id, target.id);
      del.free();
      if (info.changes > 0) {
        db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.user.id);
        db.prepare('UPDATE users SET followers_count = MAX(0, followers_count - 1) WHERE id = ?').run(target.id);
      }
    });
    res.json({ ok: true, following: false });
  } catch (e) { next(e); }
});

// Followers / following lists
router.get('/:id/followers', (req, res) => {
  const rows = all(`SELECT u.id, u.username, u.display_name, u.profile_pic, u.is_verified
    FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.followee_id = ? OR f.followee_id = (SELECT id FROM users WHERE username_lower = ?)
    ORDER BY f.created_at DESC LIMIT 100`,
    [req.params.id, req.params.id.toLowerCase()]);
  res.json({ items: rows });
});

router.get('/:id/following', (req, res) => {
  const rows = all(`SELECT u.id, u.username, u.display_name, u.profile_pic, u.is_verified
    FROM follows f JOIN users u ON u.id = f.followee_id
    WHERE f.follower_id = ? OR f.follower_id = (SELECT id FROM users WHERE username_lower = ?)
    ORDER BY f.created_at DESC LIMIT 100`,
    [req.params.id, req.params.id.toLowerCase()]);
  res.json({ items: rows });
});

// Wallet summary for self
router.get('/me/wallet', authRequired, async (req, res, next) => {
  try {
    const result = await tx((db) => {
      const spendableAcc = getOrCreateUserAccount(db, req.user.id, 'USER_OC');
      const earningsAcc = getOrCreateUserAccount(db, req.user.id, 'CREATOR_EARNINGS');
      const bal = {
        spendable: BigInt(spendableAcc.balance).toString(),
        earnings: BigInt(earningsAcc.balance).toString(),
        total: (BigInt(spendableAcc.balance) + BigInt(earningsAcc.balance)).toString(),
      };
      const entries = [];
      const stmt = db.prepare(`SELECT le.* FROM ledger_entries le
        JOIN ledger_accounts la ON la.id = le.account_id
        WHERE la.user_id = ? ORDER BY le.created_at DESC LIMIT 30`);
      stmt.bind([req.user.id]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row) entries.push(row);
      }
      stmt.free();
      return { balance: bal, entries };
    });
    res.json(result);
  } catch(e) { next(e); }
});

// Search users
router.get('/search/:query', (req, res) => {
  const q = `%${req.params.query.toLowerCase()}%`;
  const rows = all(`SELECT id, username, display_name, profile_pic, is_verified, followers_count
    FROM users WHERE username_lower LIKE ? OR display_name LIKE ?
    ORDER BY followers_count DESC LIMIT 20`, [q, q]);
  res.json({ items: rows });
});

export default router;
