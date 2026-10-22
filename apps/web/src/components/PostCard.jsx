'use client';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Bookmark, Gift, Play } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import clsx from 'clsx';

export default function PostCard({ post }) {
  const [liked, setLiked] = useState(!!post.liked);
  const [saved, setSaved] = useState(!!post.saved);
  const [likes, setLikes] = useState(post.likes_count || 0);

  const toggleLike = async () => {
    try {
      if (liked) { await api.post(`/posts/${post.id}/unlike`); setLiked(false); setLikes(n => n-1); }
      else { await api.post(`/posts/${post.id}/like`); setLiked(true); setLikes(n => n+1); }
    } catch(e) {}
  };
  const toggleSave = async () => {
    try {
      if (saved) { setSaved(false); } else { await api.post(`/posts/${post.id}/save`); setSaved(true); }
    } catch(e) {}
  };

  return (
    <article className="card p-4">
      <header className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${post.author_id}`} className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
          {(post.display_name || post.username || '?').slice(0,1).toUpperCase()}
        </Link>
        <div className="flex-1">
          <Link href={`/profile/${post.author_id}`} className="font-semibold hover:underline flex items-center gap-1">
            @{post.username} {post.is_verified && <span className="text-cyan-400 text-xs">✓</span>}
          </Link>
          <div className="text-xs text-obs-muted">{new Date(post.created_at*1000).toLocaleString()}</div>
        </div>
        <Link href={`/gifts/send?to=${post.author_id}&context=post&contextId=${post.id}`} className="btn-ghost !py-1.5 !px-3 text-xs">
          <Gift size={14} /> Gift
        </Link>
      </header>
      {post.text && <p className="whitespace-pre-wrap mb-3">{post.text}</p>}
      {post.kind === 'reel' || (post.media && post.media.some(m => m.type === 'video')) ? (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-3">
          <div className="absolute inset-0 flex items-center justify-center">
            <Link href={`/reels`} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <Play size={22} className="text-white ml-1" />
            </Link>
          </div>
        </div>
      ) : null}
      {post.media && post.media.filter(m => m.type === 'image').map((m, i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-black/20 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt="" className="w-full object-cover" />
        </div>
      ))}
      <footer className="flex items-center gap-1 pt-2">
        <button onClick={toggleLike} className={clsx('inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition', liked ? 'text-pink-500' : 'text-obs-dim hover:text-obs-text hover:bg-white/5')}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          <span className="text-sm">{likes}</span>
        </button>
        <Link href={`/posts/${post.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-obs-dim hover:text-obs-text hover:bg-white/5">
          <MessageCircle size={18} />
          <span className="text-sm">{post.comments_count || 0}</span>
        </Link>
        <button onClick={toggleSave} className={clsx('ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition', saved ? 'text-amber-400' : 'text-obs-dim hover:text-obs-text hover:bg-white/5')}>
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-obs-dim hover:text-obs-text hover:bg-white/5">
          <Share2 size={18} />
        </button>
      </footer>
    </article>
  );
}
