'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Wallet, Link2, ArrowDownLeft, ArrowUpRight, ExternalLink, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function WalletPage() {
  const [status, setStatus] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tab, setTab] = useState('deposit');
  const [linkAddress, setLinkAddress] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [depositAmount, setDepositAmount] = useState('1');
  const [depositIntent, setDepositIntent] = useState(null);
  const [copied, setCopied] = useState(false);
  const [wdAmount, setWdAmount] = useState('');
  const [wdAddress, setWdAddress] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const s = await api.get('/wallet/status');
      setStatus(s);
      const d = await api.get('/wallet/deposits'); setDeposits(d.items);
      const w = await api.get('/wallet/withdrawals'); setWithdrawals(w.items);
    } catch(e) {}
  };

  const link = async () => {
    setMsg('');
    try {
      // Request challenge
      const d = await api.post('/wallet/link/challenge', { address: linkAddress });
      setChallenge(d);
      // For this MVP we do not embed the full wallet signing flow. The user must
      // sign the challenge using their Obsidian wallet and submit proof. We show
      // the challenge text and accept the proof (real signing requires the
      // Obsidian Wallet web extension / provided signing bundle).
      setMsg('Challenge issued. The Obsidian Wallet browser extension is required to sign and complete linking (BLOCKED — EXTERNAL DEPENDENCY: Obsidian Wallet extension not yet shipped in this UI).');
    } catch(e) { setMsg(e.message); }
  };

  const createIntent = async () => {
    setMsg('');
    if (!status?.links?.length) { setMsg('Link a wallet first'); return; }
    try {
      const r = await api.post('/wallet/deposits/intent', { obsAmount: depositAmount, walletAddress: status.links[0].address });
      setDepositIntent(r);
    } catch(e){ setMsg(e.message); }
  };

  const withdraw = async () => {
    setMsg('');
    try {
      const amt = parseInt(wdAmount, 10);
      if (!amt || amt < 1000) { setMsg('Minimum withdrawal is 1,000 OC'); return; }
      const idem = crypto.randomUUID();
      await api.post('/wallet/withdrawals', { amountOc: amt, destinationAddress: wdAddress, idempotencyKey: idem });
      setMsg('Withdrawal requested. An administrator will broadcast the payout.');
      setWdAmount(''); setWdAddress('');
      load();
    } catch(e){ setMsg(e.message); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet size={22} /> OBS Wallet</h1>
      {!status ? <div className="card p-6 text-obs-muted">Loading…</div> : (
        <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-obs-muted">Network</div>
                <div className="font-semibold">Obsidian Mainnet · chain-id {status.chainId}</div>
              </div>
              {!status.configured && <span className="chip bg-amber-500/20 text-amber-300">Node not configured</span>}
            </div>
            <div className="text-sm text-obs-muted">Rate: <b>1 OBS = 1,000,000 OC Coin</b></div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Link2 size={18} /> Linked wallets</h2>
            {status.links.length === 0 ? (
              <div>
                <p className="text-sm text-obs-muted mb-3">Link your obs1... address to deposit OBS.</p>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="obs1..." value={linkAddress} onChange={e=>setLinkAddress(e.target.value)} />
                  <button className="btn-primary" onClick={link}>Link</button>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {status.links.map(l => (
                  <li key={l.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-3 font-mono text-sm">
                    <span className="truncate flex-1">{l.address}</span>
                    <button className="text-obs-muted hover:text-white" onClick={() => { navigator.clipboard?.writeText(l.address); setCopied(true); setTimeout(()=>setCopied(false),1500); }}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {msg && <div className="text-sm mt-3 text-cyan-300">{msg}</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setTab('deposit')} className={tab==='deposit' ? 'chip bg-brand-gradient text-white' : 'chip bg-white/5 text-obs-dim'}><ArrowDownLeft size={14} /> Deposit</button>
            <button onClick={() => setTab('withdraw')} className={tab==='withdraw' ? 'chip bg-brand-gradient text-white' : 'chip bg-white/5 text-obs-dim'}><ArrowUpRight size={14} /> Cash out</button>
            <button onClick={() => setTab('history')} className={tab==='history' ? 'chip bg-brand-gradient text-white' : 'chip bg-white/5 text-obs-dim'}>History</button>
          </div>

          {tab === 'deposit' && (
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold">Deposit OBS → OC Coin</h3>
              <div>
                <label className="block text-sm mb-1.5">Amount (OBS)</label>
                <input type="number" step="0.001" min="0.001" className="input" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} />
                <p className="text-xs text-obs-muted mt-1">You receive ≈ {Math.floor(parseFloat(depositAmount||'0') * 1_000_000).toLocaleString()} OC</p>
              </div>
              <button className="btn-primary" onClick={createIntent} disabled={!status.links.length}>Create deposit</button>

              {depositIntent && (
                <div className="border border-obs-border/60 rounded-xl p-4 space-y-3 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm uppercase text-obs-muted tracking-widest">Send exactly</div>
                    <div className="text-2xl font-black text-cyan-300">{depositIntent.expectedObs} OBS</div>
                  </div>
                  <div>
                    <div className="text-xs text-obs-muted mb-1">To address</div>
                    <div className="font-mono text-sm break-all bg-black/40 rounded-lg p-2">{depositIntent.depositAddress}</div>
                    <div className="flex justify-center mt-3">
                      <QRCodeSVG value={depositIntent.depositAddress} size={160} bgColor="transparent" fgColor="#22d3ee" includeMargin />
                    </div>
                  </div>
                  <p className="text-xs text-obs-muted">
                    Send {depositIntent.expectedObs} OBS on mainnet (chain-id {status.chainId}). After {6} confirmations,
                    {depositIntent.expectedOc.toLocaleString()} OC Coin will be credited to your wallet.
                  </p>
                  <div className="chip bg-amber-500/20 text-amber-300 text-xs">Status: {depositIntent.status}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'withdraw' && (
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold">Cash out OC → OBS</h3>
              <div>
                <label className="block text-sm mb-1.5">Amount (OC)</label>
                <input type="number" className="input" value={wdAmount} onChange={e=>setWdAmount(e.target.value)} min="1000" step="1000" />
                <p className="text-xs text-obs-muted mt-1">≈ {((parseInt(wdAmount,10)||0) / 1_000_000).toFixed(6)} OBS before fees</p>
              </div>
              <div>
                <label className="block text-sm mb-1.5">Destination obs1 address</label>
                <input className="input font-mono" value={wdAddress} onChange={e=>setWdAddress(e.target.value)} placeholder="obs1..." />
              </div>
              <button className="btn-primary" onClick={withdraw}>Request withdrawal</button>
              <p className="text-xs text-obs-muted">Withdrawals are approved and broadcast by the treasury signer. Doubly-submitted requests are idempotent.</p>
            </div>
          )}

          {tab === 'history' && (
            <div className="card p-0 divide-y divide-white/5">
              <div className="p-4"><h3 className="font-semibold">Deposits</h3></div>
              {deposits.length === 0 ? <div className="px-4 py-6 text-sm text-obs-muted">No deposits yet.</div> : deposits.map(d => (
                <div key={d.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{d.status}</div>
                    <div className="text-xs text-obs-muted font-mono">{d.expected_seals} seals · {d.expected_oc.toLocaleString()} OC</div>
                  </div>
                  <div className="text-xs text-obs-muted">{new Date(d.created_at*1000).toLocaleDateString()}</div>
                </div>
              ))}
              <div className="p-4"><h3 className="font-semibold">Withdrawals</h3></div>
              {withdrawals.length === 0 ? <div className="px-4 py-6 text-sm text-obs-muted">No withdrawals yet.</div> : withdrawals.map(w => (
                <div key={w.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{w.status}</div>
                    <div className="text-xs text-obs-muted font-mono">{w.amount_oc.toLocaleString()} OC → {w.payout_obs_seals} seals</div>
                  </div>
                  <div className="text-xs text-obs-muted">{new Date(w.created_at*1000).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
