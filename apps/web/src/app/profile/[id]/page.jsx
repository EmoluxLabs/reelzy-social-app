'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../store/auth';
import { Gift, Settings, MessageCircle, UserPlus, UserCheck } from 'lucide-react';

export default function ProfilePage() {
  const params = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const id = params.id === 'me' ? me?.id : params.id;

  useEffect(() => {
    if (!id) return;
    api.get(`/users/${id}`).then(d => { setProfile(d); setIsFollowing(d.is_following); }).catch(() => setProfile(null));
    api.get(`/posts/discover?limit=20`).then(d => setPosts(d.items.filter(p => p.author_id === id))).catch(()=>{});
  }, [id]);

  if (!profile) return <div className="p-8 text-center text-obs-muted">Loading…</div>;
  const isMe = me?.id === profile.id;

  const follow = async () => {
    try {
      if (isFollowing) { await api.post(`/users/${profile.id}/unfollow`); setIsFollowing(false); }
      else { await api.post(`/users/${profile.id}/follow`); setIsFollowing(true); }
    } catch(e){}
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="h-40 bg-gradient-to-br from-blue-900 to-cyan-900 relative">
        {profile.cover_pic && /* eslint-disable-next-line @next/next/no-img-element */<img src={profile.cover_pic} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      </div>
      <div className="px-4 pb-6 -mt-12">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-obs-bg">
            {(profile.display_name || profile.username).slice(0,1).toUpperCase()}
          </div>
          <div className="flex-1 flex justify-end gap-2 pt-12">
            {isMe ? (
              <Link href="/settings" className="btn-ghost !py-2"><Settings size={16} /> Edit</Link>
            ) : (
              <>
                <Link href={`/chat/dm/${profile.id}`} className="btn-ghost !py-2"><MessageCircle size={16} /></Link>
                <Link href={`/gifts/send?to=${profile.id}`} className="btn-ghost !py-2"><Gift size={16} /> Gift</Link>
                <button onClick={follow} className={isFollowing ? 'btn-ghost !py-2' : 'btn-primary !py-2'}>
                  {isFollowing ? <><UserCheck size={16} /> Following</> : <><UserPlus size={16} /> Follow</>}
                </button>
              </>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {profile.display_name}
          {profile.is_verified && <span className="text-cyan-400 text-sm">✓</span>}
        </h1>
        <div className="text-obs-muted text-sm">@{profile.username}</div>
        {profile.bio && <p className="mt-2">{profile.bio}</p>}
        {profile.website && <a className="text-cyan-400 text-sm hover:underline" href={profile.website} target="_blank" rel="noreferrer">{profile.website}</a>}
        <div className="flex gap-6 mt-4 text-sm">
          <div><b>{profile.following_count||0}</b> <span className="text-obs-muted">Following</span></div>
          <div><b>{profile.followers_count||0}</b> <span className="text-obs-muted">Followers</span></div>
        </div>
      </div>
      <div className="px-4 space-y-3 pb-8">
        {posts.length === 0 && <div className="text-obs-muted text-center py-10">No posts yet.</div>}
      </div>
    </div>
  );
}
