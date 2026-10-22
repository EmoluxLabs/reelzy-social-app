// Credit OC to a user (admin only). Used for bonuses, airdrops, manual adjustments.
import { Router } from 'express';
import { z } from 'zod';
import { tx, get } from '../db/index.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { generateId } from '@oc/shared';
import { credit, getOrCreateUserAccount } from '../services/ledger.js';
import { notify } from '../services/notifications.js';
import { OC_ECON } from '@oc/shared';

const router = Router();
router.use(authRequired, requireRole('super', 'finance'));

const creditSchema = z.object({
  userId: z.string().min(1),
  amountOc: z.number().int().positive(),
  reason: z.string().max(200).default('admin credit'),
  account: z.enum(['USER_OC', 'CREATOR_EARNINGS']).default('USER_OC'),
});

router.post('/credit', async (req, res, next) => {
  try {
    const body = creditSchema.parse(req.body);
    const target = get('SELECT id FROM users WHERE id = ? OR username_lower = ?', [body.userId, body.userId.toLowerCase()]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    let result;
    await tx((db) => {
      const acc = getOrCreateUserAccount(db, target.id, body.account);
      // Direct credit with no source (admin mint / airdrop). Uses the BONUS_LIABILITY
      // contra account so the ledger always balances: liability ↑, user asset ↑.
      const contra = db.prepare('SELECT * FROM ledger_accounts WHERE kind = ? AND user_id IS NULL');
      contra.bind(['BONUS_LIABILITY']);
      let contraAcc = contra.step() ? contra.getAsObject() : null;
      contra.free();
      if (!contraAcc) {
        const cid = generateId('acc');
        const now0 = Math.floor(Date.now()/1000);
        const ins = db.prepare('INSERT INTO ledger_accounts (id, kind, user_id, balance, created_at) VALUES (?, ?, NULL, 0, ?)');
        ins.run(cid, 'BONUS_LIABILITY', now0); ins.free();
        const sel = db.prepare('SELECT * FROM ledger_accounts WHERE id = ?');
        sel.bind([cid]); contraAcc = sel.step() ? sel.getAsObject() : null; sel.free();
      }
      const newBal = BigInt(acc.balance) + BigInt(body.amountOc);
      const newContra = BigInt(contraAcc.balance) - BigInt(body.amountOc); // liability goes more negative
      db.prepare('UPDATE ledger_accounts SET balance = ? WHERE id = ?').run(Number(newBal), acc.id);
      db.prepare('UPDATE ledger_accounts SET balance = ? WHERE id = ?').run(Number(newContra), contraAcc.id);
      const now = Math.floor(Date.now()/1000);
      const tId = generateId('ltx');
      db.prepare(`INSERT INTO ledger_entries (id, tx_id, op_type, account_id, counterparty_account_id, debit, credit, balance_after, rate_version, metadata_json, created_at)
        VALUES (?, ?, 'BONUS_GRANT', ?, ?, 0, ?, ?, ?, ?, ?)`).run(
        generateId('le'), tId, acc.id, contraAcc.id, Number(body.amountOc), Number(newBal),
        OC_ECON.INITIAL_RATE_VERSION, JSON.stringify({ actor: req.user.id, reason: body.reason }), now);
      db.prepare(`INSERT INTO ledger_entries (id, tx_id, op_type, account_id, counterparty_account_id, debit, credit, balance_after, rate_version, metadata_json, created_at)
        VALUES (?, ?, 'BONUS_GRANT', ?, ?, ?, 0, ?, ?, ?, ?)`).run(
        generateId('le'), tId, contraAcc.id, acc.id, Number(body.amountOc), Number(newContra),
        OC_ECON.INITIAL_RATE_VERSION, JSON.stringify({ user: target.id, reason: body.reason }), now);
      result = { toBalanceAfter: newBal.toString() };
      notify(db, { userId: target.id, type: 'deposit', actorId: req.user.id, payload: { amountOc: body.amountOc, reason: body.reason } });
    });
    res.json({ ok: true, ...result });
  } catch(e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation failed' });
    next(e);
  }
});

export default router;
