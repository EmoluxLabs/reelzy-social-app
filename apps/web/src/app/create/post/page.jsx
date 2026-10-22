'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

export default function CreatePost() {
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  const onFile = async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      const r = await api.upload(f);
      setMedia(m => [...m, { type: f.type.startsWith('video') ? 'video' : 'image', url: r.url }]);
    }
  };
  const remove = (i) => setMedia(m => m.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const kind = media.some(m => m.type === 'video') ? 'reel' : media.length ? 'image' : 'post';
      await api.post('/posts', { text, kind, media });
      router.push('/');
    } catch(e){ setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">New post</h1>
      <form onSubmit={submit} className="card p-5 space-y-4">
        <textarea className="input min-h-[120px]" placeholder="What's happening in your circle?" value={text} onChange={e=>setText(e.target.value)} maxLength={2000} />
        <div className="grid grid-cols-3 gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black/40">
              {m.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={m.url} className="w-full h-full object-cover" />
              )}
              <button type="button" onClick={()=>remove(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
          ))}
          <label className="aspect-square rounded-lg border-2 border-dashed border-obs-border/60 flex flex-col items-center justify-center text-obs-muted cursor-pointer hover:border-cyan-500 hover:text-cyan-400">
            <Upload size={22} />
            <span className="text-xs mt-1">Upload</span>
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFile} />
          </label>
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button disabled={busy} className="btn-primary w-full !py-3">{busy ? 'Posting...' : 'Post'}</button>
      </form>
    </div>
  );
}
