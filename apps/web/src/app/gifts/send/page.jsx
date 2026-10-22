'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import GiftAnimation from '../../../components/GiftAnimation';
import { Gift, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

function SendGiftPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const presetGift = params.get('giftId');
  const presetTo = params.get('to');
  const [gifts, setGifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [contextType, setContextType] = useState(params.get('context') || 'profile');

  useEffect(() => {
    api.get('/gifts/catalog').then(d => setGifts(d.items));
    api.get('/users/me/wallet').then(d => setBalance(d.balance));
    if (presetTo) api.get(`/users/${presetTo}`).then(setRecipient).catch(()=>{});
  }, [presetTo]);

  useEffect(() => {
    if (presetGift && gifts.length) {
      const g = gifts.find(x => x.catalog_id === presetGift || x.id === presetGift);
      if (g) setSelectedGift(g);
    }
  }, [presetGift, gifts]);

  const searchUser = async (q) => {
    if (!q) { setUsers([]); return; }
    const d = await api.get(`/users/search/${encodeURIComponent(q)}`);
    setUsers(d.items);
  };

  const after = useMemo(() => {
    if (!balance || !selectedGift) return null;
    return BigInt(balance.spendable) - BigInt(selectedGift.price_oc);
  }, [balance, selectedGift]);

  const send = async () => {
    if (!selectedGift || !recipient) return;
    setBusy(true); setErr('');
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await api.post('/gifts/send', {
        giftId: selectedGift.id, recipientId: recipient.id, contextType,
        contextId: params.get('contextId') || null, idempotencyKey,
      });
      setStatus(res);
    } catch (e) { setErr(e.message || 'Send failed'); } finally { setBusy(false); }
  };

  if (status) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card p-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <CheckCircle2 size={48} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold mb-1">Gift sent!</h2>
        <p className="text-obs-muted mb-6">{status.event.giftName} ({status.event.price.toLocaleString()} OC) delivered to @{recipient.username}.</p>
        <button onClick={() => router.push('/')} className="btn-primary w-full !py-3">Back to Circle</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 pb-10">
      <Link href={presetGift ? '/gifts' : '/'} className="inline-flex items-center gap-1 text-obs-muted text-sm"><ArrowLeft size={16} /> Back</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2"><Gift size={22} /> Send a gift</h1>
      <div className="card p-4">
        <label className="block text-sm mb-1.5">Recipient</label>
        {recipient ? (
          <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">{(recipient.display_name||recipient.username).slice(0,1).toUpperCase()}</div>
            <div className="flex-1"><div className="font-semibold">@{recipient.username}</div></div>
            {!presetTo && <button onClick={()=>{setRecipient(null);}} className="text-xs text-obs-muted">Change</button>}
          </div>
        ) : (
          <>
            <input className="input" placeholder="Search username..." onChange={e => searchUser(e.target.value)} />
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {users.map(u => (
                <button key={u.id} onClick={() => setRecipient(u)} className="w-full flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">{(u.display_name||u.username).slice(0,1).toUpperCase()}</div>
                  <div className="text-sm">@{u.username}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {!selectedGift ? (
        <div className="card p-4">
          <div className="text-sm text-obs-muted mb-2">Choose a gift</div>
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {gifts.map(g => (
              <button key={g.id} onClick={() => setSelectedGift(g)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center">
                <div className="text-2xl mb-1">{JSON.parse(g.animation_json||'{}').emoji || '🎁'}</div>
                <div className="text-xs truncate">{g.name}</div>
                <div className="text-xs text-cyan-300 font-bold">{Number(g.price_oc).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-5xl gift-glow">{JSON.parse(selectedGift.animation_json||'{}').emoji || '🎁'}</div>
            <div>
              <div className="font-bold text-lg">{selectedGift.name}</div>
              <div className="text-sm text-cyan-300 font-semibold">{Number(selectedGift.price_oc).toLocaleString()} OC</div>
              <button className="text-xs text-obs-muted hover:underline" onClick={() => setSelectedGift(null)}>Change</button>
            </div>
          </div>
          <div className="text-sm space-y-1 border-t border-white/5 pt-3">
            <div className="flex justify-between"><span className="text-obs-muted">Balance</span><span>{balance ? Number(balance.spendable).toLocaleString() : '...'} OC</span></div>
            <div className="flex justify-between"><span className="text-obs-muted">After sending</span>
              <span className={after != null && after < 0 ? 'text-red-400' : ''}>{after != null ? Number(after).toLocaleString() : '...'} OC</span>
            </div>
          </div>
        </div>
      )}
      {err && <div className="text-red-400 text-sm flex items-center gap-1"><XCircle size={14} />{err}</div>}
      <button onClick={send} disabled={!selectedGift||!recipient||busy||(after !==null && after<0)} className="btn-primary w-full !py-3 text-base">
        {busy ? 'Sending...' : `Send ${selectedGift ? selectedGift.name : 'gift'}`}
      </button>
    </div>
  );
}

export default function SendGiftPage() {
  return <Suspense fallback={<div className="p-8 text-center text-obs-muted">Loading…</div>}><SendGiftPageInner /></Suspense>;
}
