'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Heart, MessageCircle, Share2, Gift, UserPlus, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import clsx from 'clsx';

export default function Reels() {
  const [reels, setReels] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => { api.get('/posts/reels?limit=20').then(d => setReels(d.items)); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      setActiveIdx(idx);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (!reels.length) return <div className="h-screen flex items-center justify-center text-obs-muted">No reels yet. Be the first to post a reel.</div>;

  return (
    <div ref={containerRef} className="reels-container h-[calc(100vh-0px)] overflow-y-scroll no-scrollbar bg-black">
      {reels.map((r, i) => <ReelCard key={r.id} reel={r} active={i === activeIdx} />)}
    </div>
  );
}

function ReelCard({ reel, active }) {
  const [liked, setLiked] = useState(!!reel.liked);
  const [likes, setLikes] = useState(reel.likes_count || 0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const vidRef = useRef(null);

  useEffect(() => {
    if (!vidRef.current) return;
    if (active) vidRef.current.play().catch(()=>{});
    else { vidRef.current.pause(); vidRef.current.currentTime = 0; }
  }, [active]);

  const toggleLike = async () => {
    try {
      if (liked) { await api.post(`/posts/${reel.id}/unlike`); setLiked(false); setLikes(n => n-1); }
      else { await api.post(`/posts/${reel.id}/like`); setLiked(true); setLikes(n => n+1); }
    } catch {}
  };

  const video = reel.media?.find(m => m.type === 'video');
  return (
    <div className="reel-item h-[calc(100vh)] w-full relative snap-start bg-black flex items-center justify-center">
      {video ? (
        <video ref={vidRef} src={video.url} loop muted={muted} playsInline className="h-full w-full object-cover" onClick={() => setPlaying(p => !p)} />
      ) : (
        <div className="text-6xl">🎬</div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <Link href={`/profile/${reel.author_id}`} className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
            {(reel.display_name||reel.username||'?').slice(0,1).toUpperCase()}
          </div>
          <span className="font-semibold">@{reel.username}</span>
          <button className="ml-2 inline-flex items-center gap-1 btn-primary !py-1 !px-3 text-xs"><UserPlus size={12} /> Follow</button>
        </Link>
        {reel.text && <p className="text-sm line-clamp-2 max-w-md">{reel.text}</p>}
      </div>
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4">
        <button onClick={toggleLike} className="flex flex-col items-center text-white">
          <Heart size={30} fill={liked ? '#ef4444': 'none'} stroke={liked ? '#ef4444' : 'white'} />
          <span className="text-xs">{likes}</span>
        </button>
        <Link href={`/posts/${reel.id}`} className="text-white flex flex-col items-center">
          <MessageCircle size={28} />
          <span className="text-xs">{reel.comments_count || 0}</span>
        </Link>
        <button className="text-white"><Share2 size={28} /></button>
        <Link href={`/gifts/send?to=${reel.author_id}&context=post&contextId=${reel.id}`} className="text-white flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-glow">
            <Gift size={22} />
          </div>
          <span className="text-xs">Gift</span>
        </Link>
        <button onClick={() => setMuted(m => !m)} className="text-white">
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      </div>
    </div>
  );
}
