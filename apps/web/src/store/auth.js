import { create } from 'zustand';
import { api } from '../lib/api';

export const useAuth = create((set) => ({
  user: null,
  loading: true,
  async refresh() {
    try {
      const data = await api.get('/auth/me');
      set({ user: data.user, loading: false });
      return data.user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },
  async login(emailOrUsername, password) {
    const data = await api.post('/auth/login', { emailOrUsername, password });
    set({ user: data.user });
    return data;
  },
  async register({ username, email, password, displayName }) {
    const data = await api.post('/auth/register', { username, email, password, displayName });
    set({ user: data.user });
    return data;
  },
  async logout() {
    await api.post('/auth/logout');
    set({ user: null });
  },
  setUser(user) { set({ user }); },
}));
