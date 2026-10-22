/**
 * Enqueue an in-app notification + socket.io outbox event.
 *
 * Accepts an existing `db` (sql.js Database, inside a tx) so callers can enqueue
 * atomically with other writes. If `db` is omitted, runs its own short tx.
 */
import { generateId } from '@oc/shared';
import { tx } from '../db/index.js';

function write(db, { userId, type, actorId = null, payload = {}, channel = null }) {
  if (!userId) return;
  const now = Math.floor(Date.now()/1000);
  const id = generateId('n');
  const insN = db.prepare(`INSERT INTO notifications (id, user_id, type, actor_id, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  insN.run(id, userId, type, actorId, JSON.stringify(payload), now);
  insN.free();

  const evId = generateId('ev');
  const ch = channel || `user:${userId}`;
  const insO = db.prepare('INSERT INTO outbox (id, channel, event, payload_json, created_at) VALUES (?, ?, ?, ?, ?)');
  insO.run(evId, ch, 'notification', JSON.stringify({ id, type, actorId, payload, createdAt: now }), now);
  insO.free();
}

export function notify(dbOrOpts, maybeOpts) {
  if (maybeOpts) {
    // Called as notify(db, opts) from inside a tx
    write(dbOrOpts, maybeOpts);
    return;
  }
  // Called as notify(opts) from outside a tx
  const opts = dbOrOpts;
  return tx((db) => write(db, opts));
}
