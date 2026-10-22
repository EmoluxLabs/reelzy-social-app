'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { MessageCircle, Phone, Video } from 'lucide-react';

export default function Inbox() {
  const [convos, setConvos] = useState([]);
  useEffect(() => { api.get('/chat/conversations').then(d => setConvos(d.items)).catch(()=>{}); }, []);
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle size={22} /> Inbox</h1>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Link href="/calls" className="card p-4 flex items-center gap-3 hover:border-cyan-500/60"><Phone size={20} /> Voice & video calls</Link>
        <Link href="/chat" className="card p-4 flex items-center gap-3 hover:border-cyan-500/60"><Video size={20} /> Chats</Link>
      </div>
      <div className="card divide-y divide-white/5">
        {convos.length === 0 && <div className="p-8 text-center text-obs-muted">No conversations yet. Message someone from their profile.</div>}
        {convos.map(c => (
          <Link key={c.id} href={`/chat/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-white/5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
              {c.peer ? (c.peer.display_name || c.peer.username).slice(0,1).toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{c.peer ? `@${c.peer.username}` : 'Chat'}</div>
              <div className="text-sm text-obs-muted truncate">{c.last_message || 'No messages yet'}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
