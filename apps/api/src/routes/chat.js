import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { tx, get, all } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { generateId } from '@oc/shared';

const router = Router();

const msgLimiter = rateLimit({ windowMs: 60*1000, max: 60 });

function convoIdFor(a, b) {
  return [a, b].sort().join('_');
}

// Conversations list
router.get('/conversations', authRequired, (req, res) => {
  const rows = all(`SELECT c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
      (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
      cp.last_read_at, cp.muted_until
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE cp.user_id = ?
    ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
    LIMIT 100`, [req.user.id]);
  // Resolve peer display for DMs
  const enriched = rows.map(c => {
    if (c.kind === 'dm') {
      const peer = all(`SELECT u.id, u.username, u.display_name, u.profile_pic, u.is_verified, u.is_online
        FROM conversation_participants p JOIN users u ON u.id = p.user_id WHERE p.conversation_id = ? AND p.user_id != ? LIMIT 1`,
        [c.id, req.user.id])[0];
      return { ...c, peer };
    }
    return c;
  });
  res.json({ items: enriched });
});

// Start or open DM
router.post('/dm/:userId', authRequired, async (req, res, next) => {
  try {
    const peer = get('SELECT id FROM users WHERE id = ? OR username_lower = ?', [req.params.userId, req.params.userId.toLowerCase()]);
    if (!peer) return res.status(404).json({ error: 'User not found' });
    if (peer.id === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });
    const existing = all(`SELECT c.id FROM conversations c
      JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
      JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
      WHERE c.kind = 'dm' LIMIT 1`, [req.user.id, peer.id]);
    let convoId;
    if (existing.length) {
      convoId = existing[0].id;
    } else {
      await tx((db) => {
        convoId = generateId('conv');
        const now = Math.floor(Date.now()/1000);
        db.prepare('INSERT INTO conversations (id, kind, created_at, updated_at, last_message_at) VALUES (?, ?, ?, ?, ?)').run(convoId, 'dm', now, now, now);
        db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`)
          .run(convoId, req.user.id, now);
        db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`)
          .run(convoId, peer.id, now);
      });
    }
    res.json({ conversationId: convoId });
  } catch(e){ next(e); }
});

// Messages in a conversation
router.get('/conversations/:id/messages', authRequired, (req, res) => {
  const cp = get('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!cp) return res.status(403).json({ error: 'Not a participant' });
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const before = parseInt(req.query.before) || Math.floor(Date.now()/1000) + 1;
  const rows = all(`SELECT m.*, u.username, u.display_name, u.profile_pic
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ? AND m.created_at < ? AND COALESCE(m.deleted_at,0) = 0
    ORDER BY m.created_at DESC LIMIT ?`, [req.params.id, before, limit]);
  res.json({ items: rows.reverse() });
});

const sendSchema = z.object({
  body: z.string().max(5000).default(''),
  kind: z.enum(['text','image','video','voice']).default('text'),
  attachments: z.array(z.object({
    type: z.enum(['image','video','voice']), url: z.string().max(500),
    durationMs: z.number().int().optional(),
    waveform: z.array(z.number()).optional(),
    meta: z.any().optional(),
  })).default([]),
  replyTo: z.string().max(64).optional().nullable(),
});

router.post('/conversations/:id/messages', authRequired, msgLimiter, async (req, res, next) => {
  try {
    const body = sendSchema.parse(req.body);
    const cp = get('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!cp) return res.status(403).json({ error: 'Not a participant' });
    if (body.kind === 'text' && !body.body.trim() && body.attachments.length === 0) {
      return res.status(400).json({ error: 'Message is empty' });
    }
    let msgId;
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      msgId = generateId('msg');
      db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, kind, body, attachments_json, duration_ms, waveform_json, reply_to, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        msgId, req.params.id, req.user.id, body.kind, body.body,
        JSON.stringify(body.attachments),
        body.attachments.find(a=>a.durationMs)?.durationMs || null,
        body.attachments.find(a=>a.waveform) ? JSON.stringify(body.attachments.find(a=>a.waveform).waveform) : null,
        body.replyTo || null, now);
      db.prepare('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.params.id);
    });
    // Emit via socket.io if attached; also outbox
    const msg = get(`SELECT m.*, u.username, u.display_name, u.profile_pic FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`, [msgId]);
    res.status(201).json({ message: msg });
    // Emit via outbox so every API instance delivers the event.
    const outMsg = { ...msg, conversationId: req.params.id };
    tx((db) => {
      db.prepare('INSERT INTO outbox (id, channel, event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(generateId('ev'), `conv:${req.params.id}`, 'chat_message', JSON.stringify(outMsg), Math.floor(Date.now()/1000));
    }).catch(() => {});
  } catch(e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION' });
    next(e);
  }
});

router.post('/conversations/:id/read', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      db.prepare('UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?')
        .run(Math.floor(Date.now()/1000), req.params.id, req.user.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

// Call signaling (WebRTC offer/answer/ice via socket or REST)
router.post('/calls', authRequired, async (req, res, next) => {
  try {
    const peerId = String(req.body.peerId || '');
    const kind = String(req.body.kind || 'voice');
    if (!['voice','video'].includes(kind)) return res.status(400).json({ error: 'kind must be voice or video' });
    const peer = get('SELECT id FROM users WHERE id = ? OR username_lower = ?', [peerId, peerId.toLowerCase()]);
    if (!peer) return res.status(404).json({ error: 'User not found' });
    const convoRow = all(`SELECT c.id FROM conversations c
      JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
      JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
      WHERE c.kind = 'dm' LIMIT 1`, [req.user.id, peer.id]);
    let convoId;
    if (convoRow.length) convoId = convoRow[0].id;
    else {
      await tx((db) => {
        convoId = generateId('conv');
        const now = Math.floor(Date.now()/1000);
        db.prepare('INSERT INTO conversations (id, kind, created_at, updated_at, last_message_at) VALUES (?, ?, ?, ?, ?)').run(convoId, 'dm', now, now, now);
        db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`).run(convoId, req.user.id, now);
        db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`).run(convoId, peer.id, now);
      });
    }
    const callId = generateId('call');
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare(`INSERT INTO calls (id, kind, conversation_id, host_id, status, created_at) VALUES (?, ?, ?, ?, 'ringing', ?)`)
        .run(callId, kind, convoId, req.user.id, now);
      db.prepare('INSERT INTO call_participants (call_id, user_id) VALUES (?, ?)').run(callId, req.user.id);
      db.prepare('INSERT INTO call_participants (call_id, user_id) VALUES (?, ?)').run(callId, peer.id);
      db.prepare('INSERT INTO outbox (id, channel, event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(generateId('ev'), `user:${peer.id}`, 'incoming_call', JSON.stringify({ callId, from: req.user.id, kind, conversationId: convoId }), now);
    });
    res.status(201).json({ callId, conversationId: convoId, kind });
  } catch(e){ next(e); }
});

router.post('/calls/:id/accept', authRequired, async (req, res, next) => {
  try {
    const c = get('SELECT * FROM calls WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Call not found' });
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE calls SET status = 'ongoing', started_at = ? WHERE id = ? AND status = 'ringing'").run(now, req.params.id);
      db.prepare("UPDATE call_participants SET accepted = 1, joined_at = ? WHERE call_id = ? AND user_id = ?").run(now, req.params.id, req.user.id);
    });
    res.json({ ok: true, status: 'ongoing' });
  } catch(e){ next(e); }
});

router.post('/calls/:id/decline', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE calls SET status = 'declined', ended_at = ?, end_reason = 'declined' WHERE id = ? AND status = 'ringing'").run(now, req.params.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.post('/calls/:id/end', authRequired, async (req, res, next) => {
  try {
    await tx((db) => {
      const now = Math.floor(Date.now()/1000);
      db.prepare("UPDATE calls SET status = 'ended', ended_at = ?, end_reason = ? WHERE id = ? AND status IN ('ringing','ongoing')").run(now, req.body.reason || 'ended', req.params.id);
      db.prepare('UPDATE call_participants SET left_at = ? WHERE call_id = ? AND left_at IS NULL').run(now, req.params.id);
    });
    res.json({ ok: true });
  } catch(e){ next(e); }
});

router.get('/calls', authRequired, (req, res) => {
  const rows = all(`SELECT c.* FROM calls c
    JOIN call_participants cp ON cp.call_id = c.id
    WHERE cp.user_id = ?
    ORDER BY c.created_at DESC LIMIT 30`, [req.user.id]);
  res.json({ items: rows });
});

export default router;
