'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Bell, Heart, MessageCircle, UserPlus, Gift, Coins, CheckCheck } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { timeAgo } from '../../lib/utils';

function describe(n) {
  const p = n.payload || {};
  const who = n.actor_display || n.actor_username || 'Someone';
  switch (n.type) {
    case 'follow': return <>{who} <span className="text-obs-muted">followed you</span></>;
    case 'like': return <>{who} <span className="text-obs-muted">liked your post</span></>;
    case 'comment': return <>{who} <span className="text-obs-muted">commented on your post</span></>;
    case 'gift': return <>{who} <span className="text-obs-muted">sent you</span> <span className="font-semibold text-pink-400">{p.giftName || 'a gift'}</span> <span className="text-obs-muted">({Number(p.priceOc).toLocaleString()} OC)</span></>;
    case 'deposit': return <>Deposit credited <span className="text-obs-muted">+{Number(p.amountOc).toLocaleString()} OC</span></>;
    case 'withdrawal': return <>Withdrawal request <span className="text-obs-muted">({p.status || 'requested'})</span></>;
    default: return <>{n.type.replace(/_/g, ' ')}</>;
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const d = await api.get('/notifications');
    setItems(d.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api.post('/notifications/read-all', {}); load(); };
  const icons = { follow: UserPlus, like: Heart, comment: MessageCircle, gift: Gift, deposit: Coins, withdrawal: Coins };
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell size={22} /> Notifications</h1>
        <button onClick={markAll} className="btn-ghost text-sm !py-2 !px-3 inline-flex items-center gap-1"><CheckCheck size={14} /> Mark all read</button>
      </div>
      <div className="card divide-y divide-white/5">
        {loading && <div className="p-8 text-center text-obs-muted">Loading…</div>}
        {!loading && items.length === 0 && <div className="p-8 text-center text-obs-muted">No notifications yet.</div>}
        {items.map(n => {
          const Icon = icons[n.type] || Bell;
          return (
            <div key={n.id} className={`flex items-center gap-3 p-4 ${!n.read_at ? 'bg-cyan-500/5' : ''}`}>
              {n.actor_id ? (
                <Link href={`/profile/${n.actor_username}`}><Avatar user={{...n, profile_pic: n.actor_pic, display_name: n.actor_display, username: n.actor_username}} size={40} /></Link>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><Icon size={18} /></div>
              )}
              <div className="flex-1 min-w-0 text-sm">
                <div className="truncate">{describe({ ...n, payload: n.payload_json ? JSON.parse(n.payload_json) : {} })}</div>
                <div className="text-xs text-obs-muted">{timeAgo(n.created_at)}</div>
              </div>
              {!n.read_at && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
