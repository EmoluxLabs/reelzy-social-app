'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../store/auth';
import { Wordmark } from '../../components/Logo';

export default function SignupPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const register = useAuth(s => s.register);

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await register(form);
      router.push('/');
    } catch(e) { setErr(e.message || 'Signup failed'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md">
        <div className="flex justify-center mb-6"><Wordmark size={220} /></div>
        <h1 className="text-2xl font-bold text-center mb-1">Join the Circle</h1>
        <p className="text-center text-obs-muted text-sm mb-6">Create your Obsidian Circle account.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5">Username</label>
            <input className="input" value={form.username} onChange={update('username')} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Display name</label>
            <input className="input" value={form.displayName} onChange={update('displayName')} required maxLength={50} />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Email</label>
            <input type="email" className="input" value={form.email} onChange={update('email')} required />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Password</label>
            <input type="password" className="input" value={form.password} onChange={update('password')} required minLength={8} />
            <p className="text-xs text-obs-muted mt-1">At least 8 characters.</p>
          </div>
          {err && <div className="text-red-400 text-sm">{err}</div>}
          <button disabled={busy} className="btn-primary w-full !py-3">{busy ? 'Creating...' : 'Create account'}</button>
        </form>
        <div className="mt-6 text-center text-sm text-obs-muted">
          Already have an account? <Link href="/login" className="text-obs-cyan hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
