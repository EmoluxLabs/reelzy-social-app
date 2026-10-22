'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import ThemeToggle from '../../components/ThemeToggle';
import { useRouter } from 'next/navigation';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ displayName: '', bio: '', website: '' });
  const [msg, setMsg] = useState('');
  const router = useRouter();
  useEffect(() => {
    if (user) setForm({ displayName: user.display_name || '', bio: user.bio || '', website: user.website || '' });
  }, [user]);
  const save = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      const d = await api.patch('/users/me', form);
      setUser(d.user); setMsg('Saved');
    } catch(e) { setMsg(e.message); }
  };
  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <form onSubmit={save} className="card p-5 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div><label className="block text-sm mb-1.5">Display name</label><input className="input" value={form.displayName} onChange={e=>setForm(f=>({...f,displayName:e.target.value}))} /></div>
        <div><label className="block text-sm mb-1.5">Bio</label><textarea className="input min-h-[80px]" value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} maxLength={300} /></div>
        <div><label className="block text-sm mb-1.5">Website</label><input className="input" value={form.website} onChange={e=>setForm(f=>({...f,website:e.target.value}))} /></div>
        <div className="flex items-center justify-between">
          <div><div className="font-medium">Theme</div><div className="text-xs text-obs-muted">Dark or light mode</div></div>
          <ThemeToggle />
        </div>
        {msg && <div className="text-emerald-400 text-sm">{msg}</div>}
        <button className="btn-primary w-full !py-3">Save</button>
      </form>
      <button onClick={async () => { await api.post('/auth/logout'); router.push('/login'); }} className="btn-danger w-full !py-3">Sign out</button>
    </div>
  );
}
