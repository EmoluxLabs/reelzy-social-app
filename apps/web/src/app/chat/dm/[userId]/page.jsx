'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
export default function DmPage() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    api.post(`/chat/dm/${params.userId}`).then(d => router.replace(`/chat/${d.conversationId}`)).catch(() => router.replace('/inbox'));
  }, [params.userId, router]);
  return <div className="p-8 text-center text-obs-muted">Opening conversation…</div>;
}
