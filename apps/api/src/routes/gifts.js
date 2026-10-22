import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { tx, get, all } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { splitGift } from '../services/ledger.js';
import { notify } from '../services/notifications.js';
import { assertValidGiftPrice, LIMITED_GIFT_COOLDOWN_MS } from '@oc/shared';
import { ENV } from '../utils/env.js';
import { generateId } from '@oc/shared';

const router = Router();

const giftSendLimiter = rateLimit({ windowMs: 60*1000, max: ENV.GIFT_RATE_LIMIT_MAX, message: { error: 'Slow down with gifts', code: 'RATE_LIMITED' } });

// Public catalog
router.get('/catalog', (_req, res) => {
  const items = all('SELECT id, catalog_id, name, category, price_oc, rarity_tier, description, animation_json, preview_url, daily_limit_per_user, is_active FROM gifts WHERE is_active = 1 ORDER BY category, price_oc, catalog_id');
  res.json({ items });
});

router.get('/catalog/:id', (req, res) => {
  const g = get('SELECT * FROM gifts WHERE (id = ? OR catalog_id = ?) AND is_active = 1', [req.params.id, req.params.id]);
  if (!g) return res.status(404).json({ error: 'Gift not found' });
  g.animation = JSON.parse(g.animation_json || '{}');
  delete g.animation_json;
  res.json({ gift: g });
});

// Send a gift
const sendSchema = z.object({
  giftId: z.string().min(1),
  recipientId: z.string().min(1),
  contextType: z.enum(['post', 'live', 'profile', 'comment']).default('profile'),
  contextId: z.string().max(100).optional().nullable(),
  idempotencyKey: z.string().min(4).max(128),
});

router.post('/send', authRequired, giftSendLimiter, async (req, res, next) => {
  try {
    const body = sendSchema.parse(req.body);
    const gift = get('SELECT * FROM gifts WHERE (id = ? OR catalog_id = ?) AND is_active = 1', [body.giftId, body.giftId]);
    if (!gift) return res.status(404).json({ error: 'Gift not found', code: 'NO_GIFT' });
    const price = BigInt(gift.price_oc);
    assertValidGiftPrice(price);

    const recipient = get('SELECT id, username, is_suspended FROM users WHERE id = ? OR username_lower = ?', [body.recipientId, body.recipientId.toLowerCase()]);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found', code: 'NO_RECIPIENT' });
    if (recipient.is_suspended) return res.status(400).json({ error: 'Recipient is suspended' });

    let result;
    let animationEvent = null;
    await tx((db) => {
      // Enforce limited-gift per-user cooldown (24h)
      if (Number(gift.daily_limit_per_user) > 0) {
        const cd = db.prepare('SELECT last_purchase_at FROM gift_limited_cooldowns WHERE user_id = ? AND gift_id = ?');
        cd.bind([req.user.id, gift.id]);
        if (cd.step()) {
          const last = Number(cd.getAsObject().last_purchase_at);
          cd.free();
          if (Date.now() - last < LIMITED_GIFT_COOLDOWN_MS) {
            const e = new Error('You can buy this limited gift only once per 24 hours');
            e.code = 'LIMITED_COOLDOWN';
            throw e;
          }
        } else cd.free();
      }
      result = splitGift(db, {
        senderUserId: req.user.id,
        recipientUserId: recipient.id,
        priceOc: price,
        contextType: body.contextType,
        contextId: body.contextId,
        giftId: gift.id,
        idempotencyKey: body.idempotencyKey,
      });
      // Update cooldown
      if (Number(gift.daily_limit_per_user) > 0) {
        const ups = db.prepare(`INSERT INTO gift_limited_cooldowns (user_id, gift_id, last_purchase_at)
          VALUES (?, ?, ?) ON CONFLICT(user_id, gift_id) DO UPDATE SET last_purchase_at = excluded.last_purchase_at`);
        ups.run(req.user.id, gift.id, Math.floor(Date.now()/1000));
        ups.free();
      }
      // Build an outbox event for live animation (WebSocket clients)
      const evId = generateId('ev');
      const ins = db.prepare('INSERT INTO outbox (id, channel, event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)');
      const payload = JSON.stringify({
        type: 'gift',
        giftTxId: result.giftTxId,
        senderId: req.user.id,
        senderName: req.user.display_name || req.user.username,
        recipientId: recipient.id,
        giftId: gift.id,
        giftName: gift.name,
        giftCatalogId: gift.catalog_id,
        priceOc: Number(price),
        rarityTier: gift.rarity_tier,
        animation: JSON.parse(gift.animation_json || '{}'),
        contextType: body.contextType,
        contextId: body.contextId || null,
      });
      ins.run(evId, `user:${recipient.id}`, 'gift', payload, Math.floor(Date.now()/1000));
      ins.free();
      // Also fan out to the live room if gift is in a live context
      if (body.contextType === 'live' && body.contextId) {
        const ev2 = db.prepare('INSERT INTO outbox (id, channel, event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)');
        ev2.run(generateId('ev'), `live:${body.contextId}`, 'gift', payload, Math.floor(Date.now()/1000));
        ev2.free();
      }
      animationEvent = { giftName: gift.name, giftId: gift.id, price: Number(price) };
    });
    if (animationEvent) {
      notify({ userId: recipient.id, type: 'gift', actorId: req.user.id, payload: { giftId: gift.id, giftName: gift.name, priceOc: Number(price), contextType: body.contextType, contextId: body.contextId || null } }).catch(()=>{});
    }
    res.json({
      ok: true,
      transaction: {
        txId: result.txId,
        giftTxId: result.giftTxId,
        creatorShare: result.creatorShare.toString(),
        platformShare: result.platformShare.toString(),
        senderBalanceAfter: result.senderBalanceAfter.toString(),
        duplicated: !!result.duplicated,
      },
      event: animationEvent,
    });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION' });
    if (e?.code === 'INSUFFICIENT_BALANCE') return res.status(402).json({ error: e.message, code: e.code });
    if (e?.code === 'SELF_GIFT') return res.status(400).json({ error: e.message, code: e.code });
    if (e?.code === 'LIMITED_COOLDOWN') return res.status(429).json({ error: e.message, code: e.code });
    if (e?.code === 'DUPLICATE') return res.status(409).json({ error: 'Duplicate idempotency key', code: 'DUP_IDEM' });
    next(e);
  }
});

// Gift transaction history for a user (received)
router.get('/received', authRequired, (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 30);
  const offset = parseInt(req.query.offset) || 0;
  const rows = all(`SELECT gt.*, g.name AS gift_name, g.catalog_id, g.rarity_tier, g.animation_json,
    u.username AS sender_username, u.display_name AS sender_display_name, u.profile_pic AS sender_pic
    FROM gift_transactions gt
    JOIN gifts g ON g.id = gt.gift_id
    JOIN users u ON u.id = gt.sender_id
    WHERE gt.recipient_id = ?
    ORDER BY gt.created_at DESC LIMIT ? OFFSET ?`, [req.user.id, limit, offset]);
  res.json({ items: rows.map(r => ({ ...r, animation: JSON.parse(r.animation_json||'{}') })) });
});

export default router;
