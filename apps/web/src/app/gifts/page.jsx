'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { Gift, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import GiftAnimation from '../../components/GiftAnimation';

const CATEGORIES = ['Basic','Premium','Epic','Legendary','Limited'];
const CHIP_CLASS = { Basic:'chip-basic', Premium:'chip-premium', Epic:'chip-epic', Legendary:'chip-legendary', Limited:'chip-limited' };

function GiftsPageInner() {
  const [gifts, setGifts] = useState([]);
  const [category, setCategory] = useState('Basic');
  const [search, setSearch] = useState('');
  const params = useSearchParams();
  const presetTo = params.get('to');

  useEffect(() => { api.get('/gifts/catalog').then(d => setGifts(d.items)).catch(()=>{}); }, []);
  const filtered = gifts.filter(g => g.category === category && g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles size={22} className="text-cyan-400" /> Gift catalog</h1>
      <p className="text-obs-muted text-sm">320 premium gifts across 5 rarities. Gifts use OC Coin and pay 70% to creators.</p>
      <input className="input" placeholder="Search gifts..." value={search} onChange={e=>setSearch(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={clsx('chip whitespace-nowrap', category===c?'bg-brand-gradient text-white':CHIP_CLASS[c])}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.map(g => (
          <Link key={g.id} href={`/gifts/send?giftId=${g.catalog_id}${presetTo ? `&to=${presetTo}`:''}`} className="card p-3 hover:border-obs-cyan/60 transition group">
            <div className={clsx('aspect-square rounded-xl flex items-center justify-center relative mb-2 overflow-hidden',
              g.rarity_tier >= 3 ? 'bg-gradient-to-br from-purple-900/50 to-blue-900/50' : 'bg-white/5')}>
              <GiftAnimation anim={JSON.parse(g.animation_json||'{}')} name={g.name} />
              <span className={clsx('absolute top-2 right-2 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-full font-semibold', CHIP_CLASS[g.category])}>{g.category}</span>
            </div>
            <div className="font-semibold text-sm truncate">{g.name}</div>
            <div className="text-xs text-cyan-300 font-bold">{Number(g.price_oc).toLocaleString()} OC</div>
          </Link>
        ))}
      </div>
    </div>
  );
}


export default function GiftsPage() {
  return <Suspense fallback={<div className="p-8 text-center text-obs-muted">Loading gifts…</div>}><GiftsPageInner /></Suspense>;
}
