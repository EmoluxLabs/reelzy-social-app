'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
export default function CreateStory() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const r = await api.upload(f);
      await api.post('/posts', { text: '', kind: 'image', media: [{ type: f.type.startsWith('video') ? 'video':'image', url: r.url }] });
      router.push('/');
    } finally { setBusy(false); }
  };
  return (
    <div className="max-w-md mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Add to story</h1>
      <p className="text-obs-muted mb-4">Photos and clips last 24 hours.</p>
      <label className="btn-primary inline-flex cursor-pointer">
        {busy ? 'Uploading...' : 'Choose photo or video'}
        <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
      </label>
    </div>
  );
}
