'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusSquare, Radio, Inbox, User, Settings, Coins, Wallet, LogOut } from 'lucide-react';
import { IconLogo } from './Logo';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../store/auth';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/create', label: 'Create', icon: PlusSquare },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/profile/me', label: 'Profile', icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 p-4 border-r border-obs-border/40 dark:border-obs-border/40">
      <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-4">
        <IconLogo size={36} />
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-bold">obsidian</span>
          <span className="text-sm font-semibold brand-gradient-text -mt-0.5">circle</span>
        </div>
      </Link>
      <nav className="flex flex-col gap-1 flex-1">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={clsx('nav-item', isActive(it.href) && 'active')}>
            <it.icon size={20} />
            <span>{it.label}</span>
          </Link>
        ))}
        <div className="h-px bg-obs-border/40 my-2" />
        <Link href="/wallet" className={clsx('nav-item', isActive('/wallet') && 'active')}>
          <Wallet size={20} />
          <span>OBS Wallet</span>
        </Link>
        <Link href="/coin" className={clsx('nav-item', isActive('/coin') && 'active')}>
          <Coins size={20} />
          <span>OC Coin</span>
        </Link>
        {['super','moderator','finance','support'].includes(user?.role) && (
          <Link href="/admin" className={clsx('nav-item', isActive('/admin') && 'active')}>
            <Settings size={20} />
            <span>Admin</span>
          </Link>
        )}
      </nav>
      <div className="flex items-center gap-2 mt-4">
        <ThemeToggle />
        {user && (
          <button onClick={async () => { await logout(); router.push('/login'); }} className="nav-item flex-1 !py-2">
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
