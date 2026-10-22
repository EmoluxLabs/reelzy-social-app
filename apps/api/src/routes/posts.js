import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { tx, get, all } from '../db/index.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { generateId } from '@oc/shared';
import { ENV } from '../utils/env.js';
import { notify } from '../services/notifications.js';

const router = Router();

const postLimiter = rateLimit({ windowMs: 60*1000, max: 12, message: { error: 'Slow down with posts', code: 'RATE_LIMITED' } });

const postSchema = z.object({
  text: z.string().max(2000).default(''),
  kind: z.enum(['post', 'reel', 'image']).default('post'),
  media: z.array(z.object({
    type: z.enum(['image', 'video']), url: z.string().max(500),
    thumb: z.string().max(500).optional(), meta: z.any().optional(),
  })).default([]),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

router.post('/', authRequired, postLimiter, async (req, res, next) => {
  try {
    const body = postSchema.parse(req.body);
    const now = Math.floor(Date.now() / 1000);
    let id;
    await tx((db) => {
      id = generateId('post');
      const ins = db.prepare(`INSERT INTO posts
        (id, author_id, kind, text, media_json, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      ins.run(id, req.user.id, body.kind, body.text, JSON.stringify(body.media), body.visibility, now, now);
      ins.free();
      // naive hashtag extraction
      const tags = [...new Set((body.text.match(/#[\w]+/g) || []).map(t => t.slice(1).toLowerCase()))];
      for (const tag of tags.slice(0, 10)) {
        const existing = db.prepare('SELECT tag FROM hashtags WHERE tag = ?');
        existing.bind([tag]);
        if (existing.step()) {
          const up = db.prepare('UPDATE hashtags SET uses_count = uses_count + 1, last_used_at = ? WHERE tag = ?');
          up.run(now, tag); up.free();
        } else {
          const ins2 = db.prepare('INSERT INTO hashtags (tag, uses_count, last_used_at) VALUES (?, 1, ?)');
          ins2.run(tag, now); ins2.free();
        }
        existing.free();
        const ph = db.prepare('INSERT OR IGNORE INTO post_hashtags (post_id, tag) VALUES (?, ?)');
        ph.run(id, tag); ph.free();
      }
    });
    const post = getPost(id, req.user?.id);
    res.status(201).json({ post });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION' });
    next(e);
  }
});

function getPost(postId, viewerId) {
  const p = get(`SELECT p.*, u.username, u.display_name, u.profile_pic, u.is_verified,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
    (SELECT COUNT(*) FROM gift_transactions WHERE context_type = 'post' AND context_id = p.id) AS gifts_count
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`, [postId]);
  if (!p) return null;
  p.media = JSON.parse(p.media_json || '[]');
  delete p.media_json;
  p.likes_count = Number(p.likes_count || 0);
  p.comments_count = Number(p.comments_count || 0);
  p.gifts_count = Number(p.gifts_count || 0);
  if (viewerId) {
    const like = get('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?', [viewerId, p.id]);
    p.liked = !!like;
    const save = get('SELECT 1 FROM saves WHERE user_id = ? AND post_id = ?', [viewerId, p.id]);
    p.saved = !!save;
  } else { p.liked = false; p.saved = false; }
  return p;
}

router.get('/feed', authRequired, (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = parseInt(req.query.offset) || 0;
  // Following feed: own posts (any visibility), followees' posts that are public
  // or followers-only.
  const rows = all(`SELECT p.id FROM posts p
    WHERE (
      p.author_id = ?
      OR (p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)
          AND p.visibility IN ('public','followers'))
    )
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [req.user.id, req.user.id, limit, offset]);
  res.json({ items: rows.map(r => getPost(r.id, req.user.id)) });
});

router.get('/discover', optionalAuth, (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = parseInt(req.query.offset) || 0;
  const kind = req.query.kind || null;
  const params = [];
  let where = "WHERE p.visibility = 'public'";
  if (kind) { where += ' AND p.kind = ?'; params.push(kind); }
  params.push(limit, offset);
  const rows = all(`SELECT p.id FROM posts p ${where}
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, params);
  res.json({ items: rows.map(r => getPost(r.id, req.user?.id)) });
});

router.get('/reels', optionalAuth, (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = parseInt(req.query.offset) || 0;
  const rows = all(`SELECT p.id FROM posts p WHERE p.kind = 'reel' AND p.visibility = 'public'
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
  res.json({ items: rows.map(r => getPost(r.id, req.user?.id)) });
});

router.get('/search', optionalAuth, (req, res) => {
  const q = String(req.query.query || '').trim();
  if (!q) return res.json({ items: [] });
  const like = `%${q.toLowerCase().replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_')}%`;
  const rows = all(`SELECT p.id FROM posts p
     WHERE p.visibility = 'public' AND LOWER(p.text) LIKE ? ESCAPE '\\'
     ORDER BY p.created_at DESC LIMIT 30`, [like]);
  res.json({ items: rows.map(r => getPost(r.id, req.user?.id)) });
});

router.get('/:id', optionalAuth, (req, res) => {
  const p = getPost(req.params.id, req.user?.id);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  res.json({ post: p });
});

router.post('/:id/like', authRequired, async (req, res, next) => {
  try {
    const p = get('SELECT id, author_id FROM posts WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    let didLike = false;
    await tx((db) => {
      const ex = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?');
      ex.bind([req.user.id, p.id]);
      if (ex.step()) { ex.free(); return; }
      ex.free();
      db.prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)').run(req.user.id, p.id, Math.floor(Date.now()/1000));
      db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(p.id);
      didLike = true;
      // Note: notifying for likes happens after tx commit (see below)
    });
    if (didLike && p.author_id !== req.user.id) {
      notify({ userId: p.author_id, type: 'like', actorId: req.user.id, payload: { postId: p.id } }).catch(() => {});
    }
    res.json({ ok: true, liked: true, first: didLike });
  } catch(e){ next(e); }
});

router.post('/:id/unlike', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      const del = db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?');
      const info = del.run(req.user.id, req.params.id); del.free();
      if (info.changes > 0) db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(req.params.id);
    });
    res.json({ ok: true, liked: false });
  } catch(e){ next(e); }
});

router.post('/:id/save', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      const ex = db.prepare('SELECT 1 FROM saves WHERE user_id = ? AND post_id = ?');
      ex.bind([req.user.id, req.params.id]);
      if (ex.step()) { ex.free(); return; }
      ex.free();
      db.prepare('INSERT INTO saves (user_id, post_id, created_at) VALUES (?, ?, ?)').run(req.user.id, req.params.id, Math.floor(Date.now()/1000));
      db.prepare('UPDATE posts SET saves_count = saves_count + 1 WHERE id = ?').run(req.params.id);
    });
    res.json({ ok: true, saved: true });
  } catch(e){ next(e); }
});

router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const p = get('SELECT id, author_id FROM posts WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (p.author_id !== req.user.id && req.user.role !== 'super' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: 'Cannot delete this post' });
    }
    await tx((db) => {
      db.prepare('DELETE FROM posts WHERE id = ?').run(p.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

// Comments
router.get('/:id/comments', optionalAuth, (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = parseInt(req.query.offset) || 0;
  const rows = all(`SELECT c.*, u.username, u.display_name, u.profile_pic, u.is_verified
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC LIMIT ? OFFSET ?`, [req.params.id, limit, offset]);
  res.json({ items: rows });
});

router.post('/:id/comments', authRequired, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text || text.length > 1000) return res.status(400).json({ error: 'Comment must be 1-1000 characters' });
    const parent = req.body.parentId ? get('SELECT id FROM comments WHERE id = ? AND post_id = ?', [req.body.parentId, req.params.id]) : null;
    if (req.body.parentId && !parent) return res.status(400).json({ error: 'Parent comment not found' });
    let id;
    await tx((db) => {
      id = generateId('c');
      db.prepare(`INSERT INTO comments (id, post_id, author_id, parent_id, text, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.params.id, req.user.id, parent?.id || null, text, Math.floor(Date.now()/1000), Math.floor(Date.now()/1000));
      db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);
    });
    const c = get(`SELECT c.*, u.username, u.display_name, u.profile_pic, u.is_verified
      FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`, [id]);
    const post = get('SELECT author_id FROM posts WHERE id = ?', [req.params.id]);
    if (post && post.author_id !== req.user.id) {
      notify({ userId: post.author_id, type: 'comment', actorId: req.user.id, payload: { postId: req.params.id, commentId: id, text: text.slice(0, 120) } })
        .catch(() => {});
    }
    res.status(201).json({ comment: c });
  } catch(e){ next(e); }
});

export default router;
export { getPost };
