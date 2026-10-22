'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Radio, Plus, Users } from 'lucide-react';

export default function LivePage() {
  const [lives, setLives] = useState([]);
  useEffect(() => { api.get('/live').then(d => setLives(d.items)); }, []);
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Radio size={22} className="text-red-500" /> Live now</h1>
        <Link href="/create/live" className="btn-primary !py-2"><Plus size={16} /> Go live</Link>
      </div>
      {lives.length === 0 ? (
        <div className="card p-10 text-center">
          <Radio size={48} className="mx-auto mb-3 text-obs-muted" />
          <p className="text-obs-muted mb-4">No one is live right now. Be the first!</p>
          <Link href="/create/live" className="btn-primary">Start a live room</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {lives.map(l => (
            <Link key={l.id} href={`/live/${l.id}`} className="card overflow-hidden group">
              <div className={`aspect-video relative ${l.kind === 'audio' ? 'bg-gradient-to-br from-purple-800 to-pink-700' : 'bg-gradient-to-br from-red-800 to-blue-900'}`}>
                <div className="absolute top-2 left-2 chip bg-red-600 text-white font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
                </div>
                <div className="absolute bottom-2 right-2 text-xs text-white bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Users size={12} />{l.viewer_count}
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-5xl">
                  {l.kind === 'audio' ? '🎙' : '📹'}
                </div>
              </div>
              <div className="p-4">
                <div className="font-semibold">{l.title}</div>
                <div className="text-xs text-obs-muted">@{l.host_username} · {l.category || 'Just chatting'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
