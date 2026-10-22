/**
 * Immutable double-entry ledger for OC Coin.
 *
 * All operations are performed inside the caller's transaction so that business
 * logic and ledger writes commit atomically. Balances on `ledger_accounts` are
 * authoritative; they are updated on every entry.
 */
import { OC_ECON, ACCOUNT, splitGiftRevenue } from '@oc/shared';
import { generateId, txId } from '@oc/shared';

function runBound(stmt, params) { stmt.bind(params); stmt.step(); stmt.reset(); }

export function getOrCreateUserAccount(db, userId, kind = 'USER_OC') {
  const existing = db.prepare('SELECT * FROM ledger_accounts WHERE user_id = ? AND kind = ?');
  existing.bind([userId, kind]);
  let row = existing.step() ? existing.getAsObject() : null;
  existing.free();
  if (row) return row;
  const id = generateId('acc');
  const now = Math.floor(Date.now() / 1000);
  const ins = db.prepare('INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) VALUES (?, ?, ?, 0, ?)');
  runBound(ins, [id, kind, userId, now]);
  ins.free();
  const sel = db.prepare('SELECT * FROM ledger_accounts WHERE id = ?');
  sel.bind([id]);
  row = sel.step() ? sel.getAsObject() : null;
  sel.free();
  return row;
}

export function getOrCreateSystemAccount(db, kind) {
  const existing = db.prepare('SELECT * FROM ledger_accounts WHERE kind = ? AND user_id IS NULL');
  existing.bind([kind]);
  let row = existing.step() ? existing.getAsObject() : null;
  existing.free();
  if (row) return row;
  const id = generateId('acc');
  const now = Math.floor(Date.now() / 1000);
  const ins = db.prepare('INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) VALUES (?, ?, NULL, 0, ?)');
  runBound(ins, [id, kind, now]);
  ins.free();
  const sel = db.prepare('SELECT * FROM ledger_accounts WHERE id = ?');
  sel.bind([id]);
  row = sel.step() ? sel.getAsObject() : null;
  sel.free();
  return row;
}

function writeEntry(db, { txIdVal, opType, accountId, counterpartyAccountId, debit, credit, balanceAfter, rateVersion = OC_ECON.INITIAL_RATE_VERSION, metadata = {}, idempotencyKey = null }) {
  const ins = db.prepare(`INSERT INTO ledger_entries
    (id, tx_id, op_type, account_id, counterparty_account_id, debit, credit, balance_after, rate_version, metadata_json, created_at, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  runBound(ins, [
    generateId('le'), txIdVal, opType, accountId, counterpartyAccountId || null,
    Number(debit), Number(credit), Number(balanceAfter), rateVersion,
    JSON.stringify(metadata), Math.floor(Date.now() / 1000), idempotencyKey,
  ]);
  ins.free();
}

function applyDelta(db, accountId, deltaN) {
  const cur = db.prepare('SELECT balance FROM ledger_accounts WHERE id = ?');
  cur.bind([accountId]);
  const row = cur.step() ? cur.getAsObject() : null;
  cur.free();
  if (!row) throw new Error(`Unknown ledger account ${accountId}`);
  const newBalance = BigInt(row.balance) + BigInt(deltaN);
  if (newBalance < 0n) throw new Error(`Insufficient balance in account ${accountId}: have ${row.balance}, need ${-deltaN}`);
  const upd = db.prepare('UPDATE ledger_accounts SET balance = ? WHERE id = ?');
  runBound(upd, [Number(newBalance), accountId]);
  upd.free();
  return newBalance;
}

function cacheIdempotent(db, idempotencyKey, result) {
  if (!idempotencyKey) return;
  const ins = db.prepare('INSERT OR REPLACE INTO idempotency (key, result_json, created_at, expires_at) VALUES (?, ?, ?, ?)');
  runBound(ins, [idempotencyKey, JSON.stringify(result), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 86400 * 30]);
  ins.free();
}

function readIdempotent(db, idempotencyKey) {
  if (!idempotencyKey) return null;
  const stmt = db.prepare('SELECT result_json FROM idempotency WHERE key = ? AND expires_at > ?');
  stmt.bind([idempotencyKey, Math.floor(Date.now() / 1000)]);
  if (stmt.step()) { const r = JSON.parse(stmt.getAsObject().result_json); stmt.free(); return r; }
  stmt.free();
  return null;
}

export function transfer(db, { opType, fromAccountId, toAccountId, amountOc, rateVersion, metadata = {}, idempotencyKey = null }) {
  const amt = BigInt(amountOc);
  if (amt <= 0n) throw new Error('Transfer amount must be positive');
  const prior = readIdempotent(db, idempotencyKey);
  if (prior) return prior;
  const txIdVal = txId();
  const toBal = applyDelta(db, toAccountId, amt);
  writeEntry(db, { txIdVal, opType, accountId: toAccountId, counterpartyAccountId: fromAccountId, debit: 0, credit: amt, balanceAfter: toBal, rateVersion, metadata });
  const fromBal = applyDelta(db, fromAccountId, -amt);
  writeEntry(db, { txIdVal, opType, accountId: fromAccountId, counterpartyAccountId: toAccountId, debit: amt, credit: 0, balanceAfter: fromBal, rateVersion, metadata });
  const result = { txId: txIdVal, fromBalanceAfter: fromBal, toBalanceAfter: toBal };
  cacheIdempotent(db, idempotencyKey, result);
  return result;
}

export function credit(db, { opType, toAccountId, amountOc, contraKind = ACCOUNT.PENDING_DEPOSIT, rateVersion, metadata = {}, idempotencyKey = null }) {
  const amt = BigInt(amountOc);
  if (amt <= 0n) throw new Error('Credit amount must be positive');
  const prior = readIdempotent(db, idempotencyKey);
  if (prior) return prior;
  const contra = getOrCreateSystemAccount(db, contraKind);
  const txIdVal = txId();
  const toBal = applyDelta(db, toAccountId, amt);
  writeEntry(db, { txIdVal, opType, accountId: toAccountId, counterpartyAccountId: contra.id, debit: 0, credit: amt, balanceAfter: toBal, rateVersion, metadata });
  const contraBal = applyDelta(db, contra.id, -amt);
  writeEntry(db, { txIdVal, opType, accountId: contra.id, counterpartyAccountId: toAccountId, debit: amt, credit: 0, balanceAfter: contraBal, rateVersion, metadata });
  const result = { txId: txIdVal, toBalanceAfter: toBal };
  cacheIdempotent(db, idempotencyKey, result);
  return result;
}

export function splitGift(db, { senderUserId, recipientUserId, priceOc, contextType, contextId, giftId, idempotencyKey }) {
  const price = BigInt(priceOc);
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM gift_transactions WHERE idempotency_key = ?');
    existing.bind([idempotencyKey]);
    if (existing.step()) { const row = existing.getAsObject(); existing.free(); return { duplicated: true, ...row }; }
    existing.free();
  }
  const { creator, platform } = splitGiftRevenue(price);
  const senderAcc = getOrCreateUserAccount(db, senderUserId, 'USER_OC');
  const creatorAcc = getOrCreateUserAccount(db, recipientUserId, 'CREATOR_EARNINGS');
  const platformAcc = getOrCreateSystemAccount(db, 'PLATFORM_GIFT_REVENUE');

  if (BigInt(senderAcc.balance) < price) {
    const e = new Error('Insufficient OC Coin balance'); e.code = 'INSUFFICIENT_BALANCE'; throw e;
  }
  if (senderUserId === recipientUserId) {
    const e = new Error('You cannot send gifts to yourself'); e.code = 'SELF_GIFT'; throw e;
  }

  const txIdVal = txId();
  const sBal = applyDelta(db, senderAcc.id, -price);
  writeEntry(db, { txIdVal, opType: 'GIFT_SEND', accountId: senderAcc.id, counterpartyAccountId: creatorAcc.id, debit: price, credit: 0, balanceAfter: sBal, metadata: { recipient: recipientUserId, contextType, contextId, giftId, idempotencyKey } });
  const cBal = applyDelta(db, creatorAcc.id, creator);
  writeEntry(db, { txIdVal, opType: 'GIFT_CREATOR_CREDIT', accountId: creatorAcc.id, counterpartyAccountId: senderAcc.id, debit: 0, credit: creator, balanceAfter: cBal, metadata: { sender: senderUserId, contextType, contextId, giftId } });
  const pBal = applyDelta(db, platformAcc.id, platform);
  writeEntry(db, { txIdVal, opType: 'GIFT_PLATFORM_CREDIT', accountId: platformAcc.id, counterpartyAccountId: senderAcc.id, debit: 0, credit: platform, balanceAfter: pBal, metadata: { sender: senderUserId, recipient: recipientUserId, giftId } });

  const ins = db.prepare(`INSERT INTO gift_transactions
    (id, idempotency_key, sender_id, recipient_id, gift_id, context_type, context_id, price_oc, creator_share_oc, platform_share_oc, ledger_tx_id, rate_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const giftTxId = generateId('gtx');
  runBound(ins, [giftTxId, idempotencyKey, senderUserId, recipientUserId, giftId, contextType, contextId || null, Number(price), Number(creator), Number(platform), txIdVal, OC_ECON.INITIAL_RATE_VERSION, Math.floor(Date.now() / 1000)]);
  ins.free();

  return { txId: txIdVal, giftTxId, creatorShare: creator, platformShare: platform, senderBalanceAfter: sBal };
}

export function getUserOcBalance(db, userId) {
  const acc = getOrCreateUserAccount(db, userId, 'USER_OC');
  const earnings = getOrCreateUserAccount(db, userId, 'CREATOR_EARNINGS');
  return {
    spendable: BigInt(acc.balance),
    earnings: BigInt(earnings.balance),
    total: BigInt(acc.balance) + BigInt(earnings.balance),
  };
}
