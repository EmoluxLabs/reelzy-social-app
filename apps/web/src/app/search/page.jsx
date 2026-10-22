'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { formatNumber } from '../../lib/utils';

function Results({ q }) {
  const [state, setState] = useState({ loading: true, users: [], posts: [] });
  useEffect(() => {
    if (!q) { setState({ loading: false, users: [], posts: [] }); return; }
    let stop = false;
    (async () => {
      try {
        const u = await api.get(`/users/search/${encodeURIComponent(q)}`);
        const p = await api.get(`/posts/search?query=${encodeURIComponent(q)}`).catch(() => ({ items: [] }));
        if (stop) return;
        setState({ loading: false, users: u.items || [], posts: p.items || [] });
      } catch(e) { if (!stop) setState({ loading: false, users: [], posts: [] }); }
    })();
    return () => { stop = true; };
  }, [q]);

  if (state.loading) return <div className="p-4 text-obs-muted">Searching…</div>;
  if (!q) return <div className="p-8 text-center text-obs-muted">Type a name, username, or #tag to start.</div>;

  return (
    <div className="p-4 space-y-6">
      {state.users.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-obs-muted uppercase tracking-wider mb-2">People</h2>
          <div className="space-y-2">
            {state.users.map(u => (
              <Link key={u.id} href={`/profile/${u.username}`} className="flex items-center gap-3 p-3 card hover:bg-white/5">
                <Avatar user={u} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.display_name || u.username}</div>
                  <div className="text-xs text-obs-muted">@{u.username} · {formatNumber(u.followers_count)} followers</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {state.posts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-obs-muted uppercase tracking-wider mb-2">Posts</h2>
          <div className="space-y-2">
            {state.posts.map(p => (
              <Link key={p.id} href={`/posts/${p.id}`} className="block p-3 card hover:bg-white/5">
                <div className="text-sm text-obs-muted mb-1">@{p.username}</div>
                <div className="text-sm line-clamp-2">{p.text}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {state.users.length === 0 && state.posts.length === 0 && (
        <div className="p-8 text-center text-obs-muted">No results for “{q}”.</div>
      )}
    </div>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const q = params.get('q') || '';
  const [val, setVal] = useState(q);
  return (
    <div>
      <div className="sticky top-0 z-10 bg-obs-bg/80 backdrop-blur p-3 border-b border-obs-border/40 flex gap-2">
        <div className="flex-1 relative">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-obs-muted" />
          <form action="/search" method="get">
            <input name="q" defaultValue={q} className="input pl-9 !py-2" placeholder="Search…" />
          </form>
        </div>
      </div>
      <Results q={q} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-4 text-obs-muted">Loading…</div>}>
      <SearchInner />
    </Suspense>
  );
}
