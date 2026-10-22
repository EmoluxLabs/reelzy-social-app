'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Shield, Users, Flag, DollarSign, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [recon, setRecon] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then(setStats).catch(()=>{});
    api.get('/admin/reports').then(d => setReports(d.items)).catch(()=>{});
    api.get('/admin/reconciliation').then(setRecon).catch(()=>{});
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Shield size={22} /> Admin dashboard</h1>
      {!stats ? <div className="card h-32 animate-pulse" /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Users} label="Users" value={stats.users} />
          <Stat icon={Flag} label="Posts" value={stats.posts} />
          <Stat icon={AlertTriangle} label="Live now" value={stats.live} />
          <Stat icon={DollarSign} label="Platform revenue (OC)" value={Number(stats.platformRevenueOc).toLocaleString()} />
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Open reports</h2>
          {reports.length === 0 ? <div className="text-sm text-obs-muted">No open reports.</div> :
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="bg-white/5 rounded-lg p-3 text-sm">
                  <div><b>{r.target_type}</b> · {r.reason}</div>
                  <div className="text-xs text-obs-muted">by @{r.reporter_username}</div>
                </div>
              ))}
            </div>}
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Reconciliation</h2>
          {!recon ? <div className="text-sm text-obs-muted">Loading…</div> : (
            <div className="space-y-1 text-sm">
              {(recon.accounts||[]).map(a => (
                <div key={a.kind} className="flex justify-between"><span className="text-obs-muted">{a.kind}</span><span className="font-mono">{Number(a.total).toLocaleString()} OC</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/users" className="btn-ghost">Manage users</Link>
        <Link href="/admin/withdrawals" className="btn-ghost">Approve withdrawals</Link>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card p-4">
      <Icon size={18} className="text-cyan-400 mb-2" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-obs-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}
