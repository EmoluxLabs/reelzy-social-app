'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import PostCard from '../../../components/PostCard';
import { ArrowLeft, Send } from 'lucide-react';

export default function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    api.get(`/posts/${id}`).then(d => setPost(d.post));
    api.get(`/posts/${id}/comments`).then(d => setComments(d.items));
  }, [id]);
  const comment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await api.post(`/posts/${id}/comments`, { text });
    setComments(c => [...c, r.comment]);
    setText('');
  };
  if (!post) return <div className="p-8 text-obs-muted">Loading…</div>;
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-obs-muted"><ArrowLeft size={16} /> Back</Link>
      <PostCard post={post} />
      <form onSubmit={comment} className="card p-3 flex gap-2">
        <input className="input flex-1 !py-2" placeholder="Write a comment..." value={text} onChange={e=>setText(e.target.value)} />
        <button className="btn-primary !px-3 !py-2"><Send size={16} /></button>
      </form>
      <div className="space-y-2">
        {comments.map(c => (
          <div key={c.id} className="card p-3">
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/profile/${c.author_id}`} className="font-semibold text-sm">@{c.username}</Link>
              <span className="text-xs text-obs-muted">{new Date(c.created_at*1000).toLocaleString()}</span>
            </div>
            <div className="text-sm">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
