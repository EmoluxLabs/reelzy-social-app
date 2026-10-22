import Image from 'next/image';
import clsx from 'clsx';

export function IconLogo({ size = 40, className }) {
  return (
    <div className={clsx('relative inline-block', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-label="Obsidian Circle">
        <defs>
          <linearGradient id="lg1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#05070d" />
        <g stroke="url(#lg1)" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M16 44a16 16 0 1 1 0-24" opacity="0.7" />
          <path d="M20 44a16 16 0 1 1 0-24a10 10 0 0 1 10 10" />
        </g>
        <circle cx="46" cy="36" r="4" fill="#fff" />
        <circle cx="46" cy="36" r="6" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function Wordmark({ size = 180, className }) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <IconLogo size={Math.round(size * 0.28)} />
      <div className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-white dark:text-white">obsidian</span>
        </span>
        <span className="text-lg font-semibold brand-gradient-text">circle</span>
      </div>
    </div>
  );
}
