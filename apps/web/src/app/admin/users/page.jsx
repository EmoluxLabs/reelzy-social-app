'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ArrowLeft } from 'lucide-react';

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/admin/users?limit=50').then(d => setItems(d.items)); }, []);
  const search = async (e) => {
    e.preventDefault();
    api.get(`/admin/users?q=${encodeURIComponent(q)}`).then(d => setItems(d.items));
  };
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-obs-muted"><ArrowLeft size={16} /> Admin</Link>
      <h1 className="text-2xl font-bold">Users</h1>
      <form onSubmit={search} className="flex gap-2"><input className="input flex-1" placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} /><button className="btn-primary">Search</button></form>
      <div className="card divide-y divide-white/5">
        {items.map(u => (
          <div key={u.id} className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white">{(u.display_name||u.username).slice(0,1).toUpperCase()}</div>
            <div className="flex-1">
              <Link href={`/profile/${u.id}`} className="font-semibold hover:underline">@{u.username}</Link>
              <div className="text-xs text-obs-muted">{u.email} · {u.role}{u.is_verified ? ' · verified' : ''}{u.is_suspended ? ' · suspended' : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
