'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Upload, X, FileVideo } from 'lucide-react';

export default function CreateReel() {
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  const onFile = async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      if (!f.type.startsWith('video/')) { setErr('Reels require a vertical video (MP4/WebM).'); continue; }
      const r = await api.upload(f);
      setMedia(m => [...m, { type: 'video', url: r.url }]);
      setErr('');
    }
  };
  const remove = (i) => setMedia(m => m.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (!media.some(m => m.type === 'video')) { setErr('Upload a video first.'); setBusy(false); return; }
      await api.post('/posts', { text, kind: 'reel', media });
      router.push('/reels');
    } catch(e){ setErr(e.message); setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-1">Upload a reel</h1>
      <p className="text-sm text-obs-muted mb-4">Vertical 9:16 videos work best. Reels play full-screen, loop, and can be sent gifts.</p>
      <form onSubmit={submit} className="card p-5 space-y-4">
        <textarea className="input min-h-[100px]" placeholder="Add a caption... #tags welcome" value={text} onChange={e=>setText(e.target.value)} maxLength={1000} />
        <div className="grid grid-cols-2 gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black/40">
              <video src={m.url} className="w-full h-full object-cover" />
              <button type="button" onClick={()=>remove(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
          ))}
          {media.length === 0 && (
            <label className="aspect-[9/16] col-span-2 rounded-lg border-2 border-dashed border-obs-border/60 flex flex-col items-center justify-center text-obs-muted cursor-pointer hover:border-cyan-500 hover:text-cyan-400">
              <FileVideo size={32} />
              <span className="text-sm mt-2">Select vertical video</span>
              <span className="text-xs mt-1">MP4 / WebM, up to {100} MB</span>
              <input type="file" accept="video/*" capture="environment" className="hidden" onChange={onFile} />
            </label>
          )}
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button disabled={busy || !media.length} className="btn-primary w-full !py-3">{busy ? 'Uploading...' : 'Post reel'}</button>
      </form>
    </div>
  );
}
