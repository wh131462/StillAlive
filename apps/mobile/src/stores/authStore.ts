import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@still-alive/types';
import { apiClient } from '../lib/api';
import { zustandSecureStorage } from '../lib/storage';

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.login({ email, password });
          apiClient.setToken(response.token);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '登录失败';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      register: async (email, password, nickname) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.register({ email, password, nickname });
          apiClient.setToken(response.token);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '注册失败';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: () => {
        apiClient.setToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      initialize: async () => {
        try {
          const { token } = get();
          if (token) {
            apiClient.setToken(token);
            try {
              const user = await apiClient.getMe();
              set({ user, isAuthenticated: true, isInitialized: true });
            } catch {
              // Token invalid, clear state
              apiClient.setToken(null);
              set({ token: null, user: null, isAuthenticated: false, isInitialized: true });
            }
          } else {
            set({ isInitialized: true });
          }
        } catch (error) {
          // Ensure app doesn't crash on init error
          console.error('Auth init error:', error);
          set({ isInitialized: true });
        }
      },

      clearError: () => set({ error: null }),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandSecureStorage),
      partialize: (state) => ({ token: state.token }),
    }
  )
);
