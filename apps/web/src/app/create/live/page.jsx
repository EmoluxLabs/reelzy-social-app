'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Radio, Video, Mic } from 'lucide-react';

export default function CreateLive() {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('video');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const start = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api.post('/live/create', { title, kind });
      await api.post(`/live/${r.id}/start`);
      router.push(`/live/${r.id}`);
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Radio size={22} /> Go live</h1>
      <form onSubmit={start} className="card p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1.5">Room title</label>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="What are you streaming?" required maxLength={100} />
        </div>
        <div>
          <label className="block text-sm mb-2">Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>setKind('video')} className={`card p-4 text-center ${kind==='video' ? 'border-cyan-500 ring-2 ring-cyan-500/30' : ''}`}>
              <Video className="mx-auto mb-2" />
              <div className="font-semibold">Video Live</div>
              <div className="text-xs text-obs-muted">Camera & mic</div>
            </button>
            <button type="button" onClick={()=>setKind('audio')} className={`card p-4 text-center ${kind==='audio' ? 'border-cyan-500 ring-2 ring-cyan-500/30' : ''}`}>
              <Mic className="mx-auto mb-2" />
              <div className="font-semibold">Audio Room</div>
              <div className="text-xs text-obs-muted">Voice only</div>
            </button>
          </div>
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button disabled={busy} className="btn-primary w-full !py-3">{busy ? 'Starting...' : 'Start live'}</button>
        <p className="text-xs text-obs-muted text-center">Going live begins streaming immediately. Invite guests and accept gifts in real time.</p>
      </form>
    </div>
  );
}
