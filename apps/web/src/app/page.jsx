'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconLogo } from '../components/Logo';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import Feed from '../components/Feed';
import { ArrowRight, Play, Coins, Radio, Shield, Sparkles } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    if (!user) { setFeed(null); return; }
    api.get('/posts/feed?limit=10').then(d => setFeed(d.items)).catch(() => setFeed([]));
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-[70vh] text-obs-muted">Loading…</div>;

  if (!user) return <LandingPage />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Your Circle</h1>
        <Link href="/reels" className="btn-ghost !py-1.5 !px-3 text-sm">
          <Play size={14} /> Reels
        </Link>
      </div>
      <Feed items={feed} loading={!feed} />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 chip-premium mb-6">
              <Sparkles size={14} /> Obsidian Circle · Beta
            </div>
            <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tight">
              Connect. Create. <span className="brand-gradient-text">Go Live.</span>
            </h1>
            <p className="mt-5 text-obs-dim text-lg max-w-lg">
              Short-form video, live streams, creator gifts, and real OBS wallet payouts — all in one premium social platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary text-base !py-3 !px-6">
                Get started <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn-ghost text-base !py-3 !px-6">Sign in</Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              <Stat label="Gifts" value="320" />
              <Stat label="Creator cut" value="70%" />
              <Stat label="OBS/OC" value="1M" />
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-brand-gradient opacity-20 blur-3xl rounded-full" />
            <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-[3rem] border border-obs-border/40 bg-obs-panel/60 backdrop-blur shadow-glow flex items-center justify-center">
              <IconLogo size={240} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        <Feature icon={Radio} title="Live streaming" body="Video and audio rooms with real guests, live chat, and gift animations." />
        <Feature icon={Coins} title="OC Coin economy" body="Buy creators gifts. Earn as a creator. Cash out to OBS Coin at a fixed rate." />
        <Feature icon={Shield} title="Non-custodial wallet" body="Link your Obsidian wallet. Keys stay on your device. Treasury keys are isolated." />
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-2xl font-bold brand-gradient-text">{value}</div>
      <div className="text-xs uppercase tracking-widest text-obs-muted">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }) {
  return (
    <div className="card p-6">
      <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center mb-4 text-white shadow-glow-sm">
        <Icon size={20} />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-obs-dim">{body}</p>
    </div>
  );
}
