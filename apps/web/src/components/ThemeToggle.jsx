'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../store/theme';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-obs-border/60 hover:bg-white/5 transition ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
