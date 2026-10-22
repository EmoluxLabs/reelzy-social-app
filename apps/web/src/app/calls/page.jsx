'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Phone, Video, PhoneOff } from 'lucide-react';
export default function Calls() {
  const [calls, setCalls] = useState([]);
  useEffect(() => { api.get('/chat/calls').then(d => setCalls(d.items)).catch(()=>{}); }, []);
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Calls</h1>
      <div className="card divide-y divide-white/5">
        {calls.length === 0 && <div className="p-8 text-center text-obs-muted">No call history yet.</div>}
        {calls.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
              {c.kind === 'video' ? <Video size={18} /> : <Phone size={18} />}
            </div>
            <div className="flex-1 text-sm">
              <div className="font-medium">{c.kind} call · {c.status}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-obs-muted text-center mt-4">Peer-to-peer calls use WebRTC. For multi-party calls configure an SFU (LiveKit).</p>
    </div>
  );
}
