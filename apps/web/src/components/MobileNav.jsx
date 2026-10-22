'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusSquare, Radio, Inbox, User } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/discover', icon: Compass, label: 'Discover' },
  { href: '/create', icon: PlusSquare, label: 'Create', accent: true },
  { href: '/live', icon: Radio, label: 'Live' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/profile/me', icon: User, label: 'Me' },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-obs-panel/95 backdrop-blur border-t border-obs-border/50 px-2 pb-[env(safe-area-inset-bottom)]">
      <ul className="flex items-stretch justify-around">
        {items.map((it) => {
          const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} className={clsx('flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition',
                active ? 'text-obs-cyan' : 'text-obs-dim',
                it.accent && '-mt-3'
              )}>
                <span className={clsx('flex items-center justify-center', it.accent && 'w-11 h-11 rounded-full bg-brand-gradient shadow-glow text-white')}>
                  <it.icon size={it.accent ? 22 : 20} />
                </span>
                {!it.accent && <span>{it.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
