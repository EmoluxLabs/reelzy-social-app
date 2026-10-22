'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ArrowLeft, Check, X } from 'lucide-react';

export default function AdminWithdrawals() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/withdrawals?status=REQUESTED').then(d => setItems(d.items));
  useEffect(() => { load(); }, []);
  const approve = async (id) => {
    try { await api.post(`/admin/withdrawals/${id}/approve`, {}); setMsg(`Approved ${id}`); load(); }
    catch(e) { setMsg(e.message); }
  };
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-obs-muted"><ArrowLeft size={16} /> Admin</Link>
      <h1 className="text-2xl font-bold">Pending withdrawals</h1>
      {msg && <div className="text-emerald-400 text-sm">{msg}</div>}
      <div className="card divide-y divide-white/5">
        {items.length === 0 && <div className="p-6 text-obs-muted">No pending withdrawals.</div>}
        {items.map(w => (
          <div key={w.id} className="p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">@{w.username}</div>
              <div className="text-sm text-obs-muted font-mono break-all">{w.destination_address}</div>
              <div className="text-sm mt-1"><b>{Number(w.amount_oc).toLocaleString()} OC</b> → {w.payout_obs_seals} seals</div>
            </div>
            <button onClick={() => approve(w.id)} className="btn-primary !py-2 !px-3"><Check size={16} /> Approve</button>
            <button className="btn-ghost !py-2 !px-3"><X size={16} /></button>
          </div>
        ))}
      </div>
      <p className="text-xs text-obs-muted">Approval queues the payout for broadcast by the treasury signer.</p>
    </div>
  );
}
