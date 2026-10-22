'use client';
import Link from 'next/link';
import { Bell, Coins, Search, LogOut, Plus } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../store/auth';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';

export default function TopBar() {
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState(null);
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    let stop = false;
    const load = async () => {
      try {
        const w = await api.get('/users/me/wallet');
        const n = await api.get('/notifications?limit=1');
        if (!stop) {
          setBalance(w.balance);
          setUnread(n.unread || 0);
        }
      } catch(e){}
    };
    load();
    const i = setInterval(load, 30000);
    return () => { stop = true; clearInterval(i); };
  }, [user]);

  return (
    <header className="sticky top-0 z-30 bg-obs-bg/80 dark:bg-obs-bg/80 backdrop-blur border-b border-obs-border/40">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href="/" className="md:hidden flex items-center gap-2">
          <span className="text-lg font-bold">
            <span className="brand-gradient-text">OC</span>
          </span>
        </Link>
        <div className="flex-1 max-w-xl relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-obs-muted" />
          <input
            placeholder="Search creators, posts, hashtags..."
            onFocus={(e) => { e.target.blur(); router.push('/discover'); }}
            className="input pl-9 !py-2"
            readOnly
          />
        </div>
        {user && (
          <>
            <Link href="/create/post" className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-gradient-to-r from-pink-500 to-cyan-500 text-sm font-semibold text-white hover:opacity-90">
              <Plus size={16} /> Post
            </Link>
            <Link href="/coin" className="hidden sm:inline-flex btn-ghost !py-2 !px-3">
              <Coins size={16} className="text-obs-cyan" />
              <span className="font-semibold">{balance ? Number(balance.total).toLocaleString() : '—'}</span>
              <span className="text-obs-muted text-xs">OC</span>
            </Link>
            <Link href="/notifications" aria-label="Notifications" className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-obs-border/60 hover:bg-white/5">
              <Bell size={18} />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>}
            </Link>
          </>
        )}
        <ThemeToggle />
        {user ? (
          <div className="relative">
            <button onClick={() => setMenu(m => !m)} aria-label="Menu" className="w-9 h-9 rounded-full overflow-hidden border border-obs-border/60">
              <Avatar user={user} size={36} />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-48 card overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-white/5 text-xs text-obs-muted truncate">{user.display_name || user.username}</div>
                <button onClick={() => { setMenu(false); router.push('/profile/me'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5">My profile</button>
                <button onClick={() => { setMenu(false); router.push('/settings'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5">Settings</button>
                <button onClick={() => { setMenu(false); router.push('/wallet'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5">Wallet</button>
                <button onClick={() => { setMenu(false); router.push('/notifications'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5">Notifications</button>
                {['super','moderator','finance','support'].includes(user.role) && (
                  <button onClick={() => { setMenu(false); router.push('/admin'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5">Admin</button>
                )}
                <button onClick={async () => { setMenu(false); logout(); router.push('/login'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-red-400 inline-flex items-center gap-2">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="btn-primary !py-2 !px-4 text-sm">Sign in</Link>
        )}
      </div>
    </header>
  );
}
