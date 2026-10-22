'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../store/auth';
import { Wordmark } from '../../components/Logo';

export default function LoginPage() {
  const [emailOrUsername, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const login = useAuth(s => s.login);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(emailOrUsername, password);
      router.push('/');
    } catch(e) { setErr(e.message || 'Login failed'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Wordmark size={220} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">Welcome back</h1>
        <p className="text-center text-obs-muted text-sm mb-6">Sign in to continue to your Circle.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5">Email or username</label>
            <input className="input" value={emailOrUsername} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm mb-1.5">Password</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <div className="text-red-400 text-sm">{err}</div>}
          <button disabled={busy} className="btn-primary w-full !py-3">
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-obs-muted">
          Don't have an account? <Link href="/signup" className="text-obs-cyan hover:underline">Create one</Link>
        </div>
        <div className="mt-4 text-center text-xs text-obs-muted">
          Demo admin: <code className="text-obs-text">obsidian</code> / <code className="text-obs-text">Admin2026!</code>
        </div>
      </div>
    </div>
  );
}
