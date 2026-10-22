import { create } from 'zustand';

function getInitial() {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('oc-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export const useTheme = create((set, get) => ({
  theme: 'dark',
  init() {
    const t = getInitial();
    apply(t);
    set({ theme: t });
  },
  toggle() {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('oc-theme', next);
    apply(next);
    set({ theme: next });
  },
  set(t) {
    localStorage.setItem('oc-theme', t);
    apply(t);
    set({ theme: t });
  },
}));
