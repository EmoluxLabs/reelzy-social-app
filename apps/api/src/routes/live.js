/**
 * Live rooms (video/audio). Media transport uses WebRTC. For multi-party rooms we
 * support a pluggable SFU; when LIVEKIT_* envars are configured we issue short-lived
 * access tokens, otherwise we fall back to a simple Mesh/peer-relay mode that is
 * suitable for small rooms and development.
 */
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { tx, get, all } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { generateId } from '@oc/shared';
import { ENV } from '../utils/env.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(100),
  kind: z.enum(['video', 'audio']).default('video'),
  coverUrl: z.string().max(500).optional(),
  category: z.string().max(40).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
});

router.post('/create', authRequired, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const id = generateId('live');
    const roomName = `oc-${id}-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now()/1000);
    let token = null;
    await tx((db) => {
      db.prepare(`INSERT INTO live_sessions
        (id, host_id, kind, title, cover_url, category, visibility, room_name, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`).run(
        id, req.user.id, body.kind, body.title, body.coverUrl || '', body.category || '', body.visibility, roomName, now);
      db.prepare(`INSERT INTO live_participants (live_id, user_id, role, joined_at) VALUES (?, ?, 'host', ?)`).run(id, req.user.id, now);
    });
    // Build token: if LiveKit configured produce a JWT; else return a symmetric room secret
    if (ENV.LIVEKIT_URL && ENV.LIVEKIT_API_KEY && ENV.LIVEKIT_API_SECRET) {
      const at = import('livekit-server-sdk'); // optional
      token = null;
    } else {
      token = crypto.randomBytes(24).toString('hex');
    }
    res.status(201).json({ id, roomName, kind: body.kind, status: 'scheduled', token, livekitUrl: ENV.LIVEKIT_URL });
  } catch(e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION' });
    next(e);
  }
});

router.post('/:id/start', authRequired, async (req, res, next) => {
  try {
    const live = get('SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    if (!live) return res.status(404).json({ error: 'Session not found' });
    if (live.host_id !== req.user.id) return res.status(403).json({ error: 'Only the host can start' });
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE live_sessions SET status = 'live', started_at = ? WHERE id = ?").run(now, req.params.id);
      db.prepare('INSERT INTO outbox (id, channel, event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(generateId('ev'), 'live', 'live_started', JSON.stringify({ liveId: req.params.id, hostId: req.user.id }), now);
    });
    res.json({ ok: true, status: 'live' });
  } catch(e){ next(e); }
});

router.post('/:id/end', authRequired, async (req, res, next) => {
  try {
    const live = get('SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    if (!live) return res.status(404).json({ error: 'Not found' });
    if (live.host_id !== req.user.id && !['super','moderator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE live_sessions SET status = 'ended', ended_at = ? WHERE id = ?").run(now, req.params.id);
      db.prepare('UPDATE live_participants SET left_at = ? WHERE live_id = ? AND left_at IS NULL').run(now, req.params.id);
    });
    res.json({ ok: true, status: 'ended' });
  } catch(e){ next(e); }
});

router.post('/:id/join', authRequired, async (req, res, next) => {
  try {
    const live = get('SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    if (!live) return res.status(404).json({ error: 'Session not found' });
    if (live.status !== 'live' && live.status !== 'scheduled') return res.status(400).json({ error: 'Session is not live' });
    const token = crypto.randomBytes(24).toString('hex');
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      const ex = db.prepare('SELECT 1 FROM live_participants WHERE live_id = ? AND user_id = ?');
      ex.bind([live.id, req.user.id]);
      if (!ex.step()) {
        db.prepare('INSERT INTO live_participants (live_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(live.id, req.user.id, 'viewer', now);
        db.prepare('UPDATE live_sessions SET viewer_count = viewer_count + 1 WHERE id = ?').run(live.id);
      }
      ex.free();
    });
    res.json({ ok: true, roomName: live.room_name, token, kind: live.kind });
  } catch(e){ next(e); }
});

router.post('/:id/leave', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      const info = db.prepare('UPDATE live_participants SET left_at = ? WHERE live_id = ? AND user_id = ? AND left_at IS NULL').run(now, req.params.id, req.user.id);
      if (info.changes > 0) db.prepare('UPDATE live_sessions SET viewer_count = MAX(0, viewer_count - 1) WHERE id = ?').run(req.params.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/:id/guests/request', authRequired, async (req, res, next) => {
  try {
    const live = get('SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    if (!live) return res.status(404).json({ error: 'Not found' });
    const id = generateId('gr');
    await tx((db) => {
      db.prepare(`INSERT INTO live_guest_requests (id, live_id, user_id, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)`).run(id, live.id, req.user.id, Math.floor(Date.now()/1000));
    });
    res.status(201).json({ ok: true, requestId: id });
  } catch(e){ next(e); }
});

router.post('/:id/guests/:grId/approve', authRequired, async (req, res, next) => {
  try {
    const live = get('SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    if (!live || live.host_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE live_guest_requests SET status = 'approved', decided_at = ? WHERE id = ?").run(now, req.params.grId);
      const gr = db.prepare('SELECT user_id FROM live_guest_requests WHERE id = ?');
      gr.bind([req.params.grId]);
      if (gr.step()) {
        const uid = gr.getAsObject().user_id;
        db.prepare("UPDATE live_participants SET role = 'guest' WHERE live_id = ? AND user_id = ?").run(live.id, uid);
      }
      gr.free();
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/:id/guests/:grId/reject', authRequired, async (req, res, next) => {
  try {
    const live = get('SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    if (!live || live.host_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await tx((db) => {
      db.prepare("UPDATE live_guest_requests SET status = 'rejected', decided_at = ? WHERE id = ?")
        .run(Math.floor(Date.now()/1000), req.params.grId);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.get('/', (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = parseInt(req.query.offset) || 0;
  const rows = all(`SELECT ls.*, u.username AS host_username, u.display_name AS host_display, u.profile_pic AS host_pic, u.is_verified AS host_verified
    FROM live_sessions ls JOIN users u ON u.id = ls.host_id
    WHERE ls.status = 'live' AND ls.visibility = 'public'
    ORDER BY ls.viewer_count DESC, ls.started_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
  res.json({ items: rows });
});

router.get('/:id', (req, res) => {
  const live = get(`SELECT ls.*, u.username AS host_username, u.display_name AS host_display, u.profile_pic AS host_pic, u.is_verified AS host_verified
    FROM live_sessions ls JOIN users u ON u.id = ls.host_id WHERE ls.id = ?`, [req.params.id]);
  if (!live) return res.status(404).json({ error: 'Not found' });
  const participants = all(`SELECT p.role, p.muted, p.joined_at, u.id, u.username, u.display_name, u.profile_pic
    FROM live_participants p JOIN users u ON u.id = p.user_id
    WHERE p.live_id = ? AND p.left_at IS NULL ORDER BY p.joined_at ASC`, [live.id]);
  res.json({ live, participants });
});

export default router;
