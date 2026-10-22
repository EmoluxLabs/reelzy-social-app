'use client';

import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import MobileNav from '../../components/MobileNav';
import { useAuth } from '../../store/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthPage && pathname !== '/') {
      router.push('/login');
    }
  }, [user, loading, pathname, isAuthPage, router]);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <TopBar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
