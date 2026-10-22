'use client';

import { useEffect } from 'react';
import { useAuth } from '../store/auth';
import { useTheme } from '../store/theme';

export default function Providers({ children }) {
  const refresh = useAuth((s) => s.refresh);
  const initTheme = useTheme((s) => s.init);
  useEffect(() => { initTheme(); refresh(); }, [initTheme, refresh]);
  return children;
}
