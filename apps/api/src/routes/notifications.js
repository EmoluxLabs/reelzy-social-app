import { Router } from 'express';
import { tx, get, all } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 30);
  const rows = all(`SELECT n.*, u.username AS actor_username, u.display_name AS actor_display, u.profile_pic AS actor_pic
    FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ?`, [req.user.id, limit]);
  const unread = all('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id])[0].n;
  res.json({ items: rows, unread: Number(unread) });
});

router.post('/read-all', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Math.floor(Date.now()/1000), req.user.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/:id/read', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL').run(Math.floor(Date.now()/1000), req.params.id, req.user.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

export default router;
