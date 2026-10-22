'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { FileVideo, Image as ImageIcon, Type, Radio, Upload } from 'lucide-react';

export default function CreatePage() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Create</h1>
      <div className="grid grid-cols-2 gap-3">
        <CreateOption href="/create/post" icon={<Type size={28} />} label="Post" desc="Share text, links, or photos" />
        <CreateOption href="/create/reel" icon={<FileVideo size={28} />} label="Reel" desc="Vertical short video" />
        <CreateOption href="/create/live" icon={<Radio size={28} />} label="Go live" desc="Video or audio room" />
        <CreateOption href="/create/story" icon={<ImageIcon size={28} />} label="Story" desc="24-hour photo or clip" />
      </div>
    </div>
  );
}

function CreateOption({ href, icon, label, desc }) {
  return (
    <Link href={href} className="card p-6 hover:border-obs-cyan/60 transition group">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-cyan-300 mb-4 group-hover:scale-110 transition">
        {icon}
      </div>
      <div className="font-semibold text-lg">{label}</div>
      <div className="text-sm text-obs-muted">{desc}</div>
    </Link>
  );
}
