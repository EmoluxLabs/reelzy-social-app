'use client';
export default function GiftAnimation({ anim, name }) {
  const emoji = anim?.emoji || '🎁';
  return (
    <div className="text-5xl gift-glow group-hover:animate-float">{emoji}</div>
  );
}
