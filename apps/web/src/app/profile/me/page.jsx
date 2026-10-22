'use client';
export const dynamic = 'force-dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../store/auth';

export default function ProfileMeRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else router.replace(`/profile/${user.id}`);
  }, [user, loading, router]);
  return <div className="p-8 text-center text-obs-muted">Loading your profile…</div>;
}
