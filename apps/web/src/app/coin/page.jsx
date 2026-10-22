'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Wallet, ArrowDownLeft, ArrowUpRight, Gift, Coins, RefreshCw } from 'lucide-react';

export default function CoinPage() {
  const [data, setData] = useState(null);
  const [converting, setConverting] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/users/me/wallet').then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  const convert = async () => {
    if (!data) return;
    setConverting(true); setMsg('');
    try {
      const amt = Number(data.balance.earnings);
      await api.post('/wallet/earnings/convert', { amountOc: amt });
      setMsg(`Converted ${amt.toLocaleString()} OC to spendable.`);
      load();
    } catch(e) { setMsg(e.message); } finally { setConverting(false); }
  };
  if (!data) return <div className="p-8 text-obs-muted">Loading…</div>;
  const { balance, entries } = data;
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">OC Coin</h1>
      <div className="card p-6 bg-gradient-to-br from-blue-900/60 to-cyan-900/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm uppercase tracking-widest text-white/70">Total balance</span>
          <Coins className="text-cyan-300" size={22} />
        </div>
        <div className="text-4xl font-black mb-1">{Number(balance.total).toLocaleString()} <span className="text-lg font-semibold text-cyan-300">OC</span></div>
        <div className="text-sm text-white/60">= {(Number(balance.total)/1_000_000).toFixed(6)} OBS</div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-black/20 rounded-xl p-3 text-sm">
            <div className="text-white/60 mb-1">Spendable</div>
            <div className="font-semibold">{Number(balance.spendable).toLocaleString()} OC</div>
          </div>
          <div className="bg-black/20 rounded-xl p-3 text-sm">
            <div className="text-white/60 mb-1 flex items-center justify-between">
              <span>Creator earnings</span>
              {Number(balance.earnings) > 0 && (
                <button onClick={convert} disabled={converting} className="text-xs text-cyan-300 hover:text-white inline-flex items-center gap-1">
                  <RefreshCw size={12} /> {converting ? '...' : 'Convert'}
                </button>
              )}
            </div>
            <div className="font-semibold">{Number(balance.earnings).toLocaleString()} OC</div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Link href="/wallet" className="btn-primary flex-1 !py-2.5"><ArrowDownLeft size={16} /> Deposit OBS</Link>
          <Link href="/wallet?tab=withdraw" className="btn-ghost flex-1 !py-2.5"><ArrowUpRight size={16} /> Cash out</Link>
          <Link href="/gifts" className="btn-ghost !py-2.5 px-4"><Gift size={16} /></Link>
        </div>
        <p className="text-xs text-white/50 mt-4">Fixed rate: <b>1 OBS = 1,000,000 OC Coin</b>. Gifts are split 70% creator / 30% platform.</p>
        {msg && <div className="text-sm text-cyan-300 mt-2">{msg}</div>}
      </div>
      <div className="card p-4">
        <h2 className="font-semibold mb-3">Recent transactions</h2>
        <div className="divide-y divide-white/5">
          {(entries||[]).slice(0,20).map(e => (
            <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="font-medium">{e.op_type.replace(/_/g,' ')}</div>
                <div className="text-xs text-obs-muted">{new Date(e.created_at*1000).toLocaleString()}</div>
              </div>
              <div className={Number(e.credit) > 0 ? 'text-emerald-400 font-semibold' : 'text-obs-dim font-semibold'}>
                {Number(e.credit) > 0 ? '+' : '-'}{Number(e.credit) > 0 ? e.credit : e.debit} OC
              </div>
            </div>
          ))}
          {(!entries || entries.length === 0) && <div className="text-center text-obs-muted text-sm py-6">No transactions yet.</div>}
        </div>
      </div>
    </div>
  );
}
