'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { Search, TrendingUp, Flame, Radio, Users } from 'lucide-react';

export default function Discover() {
  const [tab, setTab] = useState('forYou');
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    let url = '/posts/discover?limit=20';
    if (tab === 'reels') url = '/posts/reels?limit=20';
    api.get(url).then(d => setItems(d.items)).catch(() => setItems([]));
  }, [tab]);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) { setSearchResults(null); return; }
    try {
      const u = await api.get(`/users/search/${encodeURIComponent(query)}`);
      setSearchResults(u.items);
    } catch { setSearchResults([]); }
  };

  const tabs = [
    { id: 'forYou', label: 'For you', icon: Flame },
    { id: 'reels', label: 'Reels', icon: TrendingUp },
    { id: 'live', label: 'Live', icon: Radio },
    { id: 'creators', label: 'Creators', icon: Users },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 w-full">
      <form onSubmit={search} className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-obs-muted" />
        <input className="input pl-10" placeholder="Search users, posts, hashtags" value={query} onChange={e => setQuery(e.target.value)} />
      </form>
      {searchResults && (
        <div className="card p-3 mb-4 space-y-2">
          <div className="text-xs uppercase text-obs-muted px-2">Users</div>
          {searchResults.length === 0 && <div className="px-2 py-4 text-center text-obs-muted text-sm">No results</div>}
          {searchResults.map(u => (
            <Link key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                {(u.display_name || u.username).slice(0,1).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">@{u.username}</div>
                <div className="text-xs text-obs-muted">{u.followers_count} followers</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`chip ${tab===t.id?'bg-brand-gradient text-white':'bg-white/5 text-obs-dim'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>
      {tab === 'live' ? <LivePreview /> :
       tab === 'creators' ? <CreatorsPreview /> :
       !items ? <div className="space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="card h-56 animate-pulse"/>)}</div> :
       <div className="space-y-4">{items.map(p => <PostCard key={p.id} post={p} />)}</div>}
    </div>
  );
}

function LivePreview() {
  const [lives, setLives] = useState([]);
  useEffect(() => { api.get('/live').then(d => setLives(d.items)).catch(() => setLives([])); }, []);
  if (!lives.length) return <div className="card p-10 text-center text-obs-muted">No live rooms right now. <Link className="text-cyan-400 underline" href="/create">Go live</Link></div>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {lives.map(l => (
        <Link key={l.id} href={`/live/${l.id}`} className="card p-0 overflow-hidden group">
          <div className="aspect-video bg-gradient-to-br from-red-600 to-purple-700 relative">
            <div className="absolute top-2 left-2 chip bg-red-600 text-white">LIVE</div>
            <div className="absolute bottom-2 right-2 text-xs text-white bg-black/40 px-2 py-0.5 rounded-full">{l.viewer_count || 0} watching</div>
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold truncate">{l.title}</div>
            <div className="text-xs text-obs-muted">@{l.host_username}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CreatorsPreview() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    api.get('/users/search/a').then(d => setUsers(d.items)).catch(() => {});
  }, []);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {users.map(u => (
        <Link key={u.id} href={`/profile/${u.id}`} className="card p-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold mb-2">
            {(u.display_name || u.username).slice(0,1).toUpperCase()}
          </div>
          <div className="font-semibold">@{u.username}</div>
          <div className="text-xs text-obs-muted">{u.followers_count} followers</div>
        </Link>
      ))}
    </div>
  );
}
