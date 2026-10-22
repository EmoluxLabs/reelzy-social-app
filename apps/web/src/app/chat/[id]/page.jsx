'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { io } from 'socket.io-client';
import { ArrowLeft, Send, Phone, Video } from 'lucide-react';
import { useAuth } from '../../../store/auth';

export default function ChatPage() {
  const params = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottom = useRef(null);
  const sockRef = useRef(null);

  useEffect(() => {
    api.get(`/chat/conversations/${params.id}/messages?limit=100`).then(d => setMessages(d.items)).catch(()=>{});
    const s = io({ path: '/socket.io' });
    s.on('connect', () => s.emit('join_conversation', params.id));
    s.on('chat_message', (m) => {
      if (m.conversationId === params.id || m.conversation_id === params.id) {
        setMessages(ms => {
          if (ms.find(x => x.id === m.id)) return ms;
          return [...ms, { ...m, isSelf: m.sender_id === user?.id || m.senderId === user?.id }];
        });
      }
    });
    sockRef.current = s;
    return () => { s.emit('leave_conversation', params.id); s.disconnect(); };
  }, [params.id, user?.id]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const r = await api.post(`/chat/conversations/${params.id}/messages`, { body: text, kind: 'text' });
      setMessages(m => [...m, r.message]);
      setText('');
    } catch(e){}
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] max-w-2xl mx-auto w-full">
      <header className="card !rounded-none !border-x-0 !border-t-0 flex items-center gap-3 p-3">
        <Link href="/inbox" className="inline-flex"><ArrowLeft /></Link>
        <div className="flex-1"><div className="font-semibold">Chat</div><div className="text-xs text-obs-muted">End-to-end encrypted coming soon</div></div>
        <button className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><Phone size={16} /></button>
        <Link href={`/calls/new?peer=${params.id}`} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><Video size={16} /></Link>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => {
          const isSelf = m.isSelf ?? (user && (m.sender_id === user.id));
          return (
          <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isSelf ? 'bg-brand-gradient text-white' : 'bg-white/10'}`}>
              {m.body}
            </div>
          </div>);
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="p-3 border-t border-obs-border/40 flex gap-2">
        <input className="input flex-1" placeholder="Message..." value={text} onChange={e=>setText(e.target.value)} />
        <button className="btn-primary !px-4 !py-2"><Send size={18} /></button>
      </form>
    </div>
  );
}
