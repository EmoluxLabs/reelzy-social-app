'use client';

export default function Avatar({ user, size = 40 }) {
  if (!user) return <div style={{ width: size, height: size }} className="rounded-full bg-white/10" />;
  const src = user.profile_pic || user.avatar;
  const initial = (user.display_name || user.username || '?').slice(0, 1).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={user.username || ''}
        width={size}
        height={size}
        className="rounded-full object-cover bg-white/5"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-gradient-to-br from-pink-500 to-cyan-500 flex items-center justify-center text-white font-semibold"
    >
      {initial}
    </div>
  );
}
