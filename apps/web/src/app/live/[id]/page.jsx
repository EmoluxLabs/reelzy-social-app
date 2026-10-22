'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { io } from 'socket.io-client';
import { Send, Gift, Hand, Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

export default function LiveRoom() {
  const params = useParams();
  const [live, setLive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const remoteVideos = useRef({});

  useEffect(() => {
    api.get(`/live/${params.id}`).then(async (d) => {
      setLive(d.live);
      await api.post(`/live/${params.id}/join`);
      setJoined(true);
    });
    const sock = io({ path: '/socket.io' });
    sock.on('connect', () => {
      sock.emit('join_live', params.id);
    });
    sock.on('live_chat', (msg) => {
      setMessages(m => [...m.slice(-50), msg]);
    });
    sock.on('gift', (g) => {
      setMessages(m => [...m.slice(-50), { system: true, text: `${g.senderName} sent ${g.giftName}!`, gift: g }]);
    });
    socketRef.current = sock;
    return () => { sock.disconnect(); api.post(`/live/${params.id}/leave`).catch(()=>{}); };
  }, [params.id]);

  useEffect(() => {
    if (!joined || live?.kind !== 'video') return;
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true }).then(stream => {
      localStream.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {});
    return () => { localStream.current?.getTracks().forEach(t => t.stop()); };
  }, [joined, live?.kind]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current?.emit('live_chat', { liveId: params.id, text });
    setText('');
  };

  if (!live) return <div className="p-8 text-obs-muted">Loading…</div>;

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col lg:flex-row">
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {live.kind === 'video' ? (
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <div className="text-7xl mb-4">🎙</div>
            <div className="text-white/80 text-lg font-semibold">{live.title}</div>
            <div className="text-white/50 text-sm">Audio room · @{live.host_username}</div>
          </div>
        )}
        <div className="absolute top-3 left-3 chip bg-red-600 text-white font-bold"><span className="w-2 h-2 rounded-full bg-white animate-pulse mr-1" />LIVE</div>
        <div className="absolute top-3 right-3 chip bg-black/60 text-white"><Users size={14} />{live.viewer_count}</div>
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
          <button onClick={() => setMicOn(v => !v)} className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center">
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          {live.kind === 'video' && (
            <button onClick={() => setCamOn(v => !v)} className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center">
              {camOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          )}
          <button onClick={() => { localStream.current?.getTracks().forEach(t => t.stop()); window.history.back(); }} className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center">
            <PhoneOff size={20} />
          </button>
          <button className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center"><Hand size={20} /></button>
          <Link href={`/gifts/send?to=${live.host_id}&context=live&contextId=${live.id}`} className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-glow">
            <Gift size={20} />
          </Link>
        </div>
      </div>
      <aside className="w-full lg:w-80 border-l border-obs-border/40 flex flex-col bg-obs-panel">
        <div className="p-4 border-b border-obs-border/40">
          <div className="font-semibold">{live.title}</div>
          <div className="text-xs text-obs-muted">Hosted by @{live.host_username}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm" id="chat-messages">
          {messages.map((m, i) => m.system ? (
            <div key={i} className="text-xs text-cyan-300 text-center py-1 animate-pulse">{m.text}</div>
          ) : (
            <div key={i}><b className="text-cyan-300">Guest:</b> {m.text}</div>
          ))}
        </div>
        <form onSubmit={send} className="p-3 border-t border-obs-border/40 flex gap-2">
          <input className="input !py-2" placeholder="Say something..." value={text} onChange={e=>setText(e.target.value)} />
          <button className="btn-primary !px-3 !py-2"><Send size={16} /></button>
        </form>
      </aside>
    </div>
  );
}
