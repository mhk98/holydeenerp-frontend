import { create } from 'zustand';
import type { AuthUser } from '@/types';

/** "loading" until the first silent refresh settles on app start. */
export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Access token lives in memory only; the refresh token is an httpOnly cookie. */
  accessToken: string | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ status: 'authenticated', user, accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ status: 'guest', user: null, accessToken: null }),
}));
