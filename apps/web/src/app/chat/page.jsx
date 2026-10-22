'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
export default function ChatList() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get('/chat/conversations').then(d => setItems(d.items)); }, []);
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Chats</h1>
      <div className="card divide-y divide-white/5">
        {items.length === 0 && <div className="p-8 text-center text-obs-muted">No conversations yet.</div>}
        {items.map(c => (
          <Link key={c.id} href={`/chat/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-white/5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
              {c.peer ? (c.peer.display_name||c.peer.username).slice(0,1).toUpperCase() : '?'}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{c.peer ? `@${c.peer.username}` : 'Chat'}</div>
              <div className="text-sm text-obs-muted truncate">{c.last_message || 'Say hi'}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
