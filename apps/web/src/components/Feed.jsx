'use client';
import PostCard from './PostCard';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';

export default function Feed({ items, loading }) {
  if (loading) return <div className="space-y-4">{Array.from({length:3}).map((_,i)=><div key={i} className="card h-64 animate-pulse" />)}</div>;
  if (!items?.length) {
    return (
      <div className="card p-10 text-center">
        <p className="text-obs-dim mb-3">Your feed is empty.</p>
        <p className="text-sm text-obs-muted">Follow creators and discover content to fill your circle.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4 pb-8">
      {items.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
