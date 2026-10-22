/**
 * Obsidian Circle API server.
 * - Express 4 HTTP API
 * - Socket.IO for real-time chat, live-room events, notifications
 * - sql.js SQLite database (see src/db/index.js)
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENV } from './utils/env.js';
import { initDb, all } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import giftRoutes from './routes/gifts.js';
import walletRoutes from './routes/wallet.js';
import liveRoutes from './routes/live.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import notifRoutes from './routes/notifications.js';
import mediaRoutes from './routes/media.js';
import adminCreditRoutes from './routes/admin-credit.js';
import { verifyToken } from './utils/jwt.js';
import { DEPOSIT_STATE } from '@oc/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function boot() {
  await initDb();
  await runMigrations();
  // Seed on first boot (idempotent)
  try { await seed(); } catch (e) { console.warn('[boot] seed skipped:', e.message); }

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // we serve UI from Next.js which sets its own CSP
  }));
  app.use(cors({ origin: ENV.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Static uploads
  app.use('/uploads', express.static(path.resolve(ENV.UPLOAD_DIR), { maxAge: '7d' }));

  app.get('/health', (_req, res) => res.json({ ok: true, name: 'Obsidian Circle API', version: '1.0.0' }));
  app.get('/api/config', (_req, res) => res.json({
    brand: 'Obsidian Circle',
    chainId: 7777,
    addressPrefix: 'obs1',
    ocPerObs: '1000000',
    creatorShareBps: 7000,
    platformShareBps: 3000,
    minGiftPrice: 1000,
    maxGiftPrice: 10000000,
    livekitConfigured: !!(ENV.LIVEKIT_URL && ENV.LIVEKIT_API_KEY && ENV.LIVEKIT_API_SECRET),
  }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/gifts', giftRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/live', liveRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notifRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/admin', adminCreditRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('[api error]', err);
    // Sanitize BigInt values that slipped into responses (defence-in-depth)
    const safe = (v) => {
      if (typeof v === 'bigint') return v.toString();
      if (Array.isArray(v)) return v.map(safe);
      if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) out[k] = safe(v[k]);
        return out;
      }
      return v;
    };
    const body = { error: err.message || 'Internal error', code: err.code || 'INTERNAL' };
    res.status(err.status || 500).json(safe(body));
  });

  // BigInt-safe JSON helper
  const originalJson = express.response.json;
  express.response.json = function (obj) {
    const seen = new WeakSet();
    const sanitize = (v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v === null || v === undefined) return v;
      if (typeof v !== 'object') return v;
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      if (Array.isArray(v)) return v.map(sanitize);
      const out = {};
      for (const k of Object.keys(v)) out[k] = sanitize(v[k]);
      return out;
    };
    return originalJson.call(this, sanitize(obj));
  };

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: ENV.CORS_ORIGIN.split(','), credentials: true },
    path: '/socket.io',
  });

  // Socket.IO auth — accept token from auth payload OR httpOnly cookie
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token;
    if (!token && socket.handshake.headers?.cookie) {
      try {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies[ENV.SESSION_COOKIE];
      } catch {}
    }
    if (!token) return next(new Error('no token'));
    const payload = verifyToken(token);
    if (!payload) return next(new Error('bad token'));
    // Look up user (ensures not suspended / exists)
    const user = get('SELECT id, username, display_name, role, is_suspended FROM users WHERE id = ?', [payload.sub]);
    if (!user || user.is_suspended) return next(new Error('unauthorized'));
    socket.userId = user.id;
    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);
    socket.on('join_conversation', (convId) => { socket.join(`conv:${convId}`); });
    socket.on('leave_conversation', (convId) => { socket.leave(`conv:${convId}`); });
    socket.on('join_live', (liveId) => { socket.join(`live:${liveId}`); });
    socket.on('leave_live', (liveId) => { socket.leave(`live:${liveId}`); });
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('typing', { userId, isTyping });
    });
    socket.on('chat_message', (msg) => { io.to(`conv:${msg.conversationId}`).emit('chat_message', msg); });
    socket.on('live_chat', ({ liveId, text }) => {
      io.to(`live:${liveId}`).emit('live_chat', { liveId, userId, text, at: Date.now() });
    });
    socket.on('signal', ({ to, payload }) => {
      io.to(`user:${to}`).emit('signal', { from: userId, payload });
    });
    socket.on('disconnect', () => {});
  });

  // Background: sweep expired deposit intents every minute
  setInterval(() => {
    try {
      tx((db) => {
        const now = Math.floor(Date.now()/1000);
        db.prepare(`UPDATE obs_deposits SET status = ? WHERE status = ? AND expires_at < ?`)
          .run(DEPOSIT_STATE.EXPIRED, DEPOSIT_STATE.AWAITING, now);
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }, 60*1000);

  // Background: when OBS_RPC_URL is configured, poll DETECTED deposits for confirmations.
  // Stub for now — a production deployment replaces this with a proper indexer.
  setInterval(async () => {
    if (!ENV.OBS_RPC_URL) return;
    try {
      // Real RPC verification goes here; we leave the adapter pluggable.
    } catch { /* ignore */ }
  }, 30*1000);

  // Background: flush outbox to socket.io every 250ms
  setInterval(async () => {
    try {
      const events = all('SELECT id, channel, event, payload_json FROM outbox WHERE delivered_at IS NULL ORDER BY created_at ASC LIMIT 200');
      if (!events.length) return;
      let payloadsOk = true;
      for (const ev of events) {
        try {
          const payload = JSON.parse(ev.payload_json);
          io.to(ev.channel).emit(ev.event, payload);
        } catch { payloadsOk = false; }
      }
      // Mark delivered
      await tx((db) => {
        const upd = db.prepare('UPDATE outbox SET delivered_at = ? WHERE id = ?');
        const now = Math.floor(Date.now()/1000);
        for (const ev of events) upd.run(now, ev.id);
        upd.free();
      });
    } catch (e) { /* ignore */ }
  }, 250);

  const port = ENV.PORT;
  server.listen(port, () => {
    console.log(`[oc-api] listening on :${port} (env=${ENV.NODE_ENV})`);
    console.log(`[oc-api] CORS origin: ${ENV.CORS_ORIGIN}`);
    if (ENV.OBS_RPC_URL) console.log(`[oc-api] OBS RPC: ${ENV.OBS_RPC_URL}`);
    else console.log('[oc-api] OBS RPC not configured — deposit verification requires OBS_RPC_URL');
  });
}

boot().catch((e) => { console.error('[boot] fatal', e); process.exit(1); });
