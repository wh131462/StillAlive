import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@still-alive/types';
import { apiClient } from '../lib/api';
import { zustandSecureStorage } from '../lib/storage';

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Password reset flow state
  resetEmail: string | null;
  resetCodeVerified: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearError: () => void;
  setUser: (user: User) => void;

  // Password reset actions
  sendResetCode: (email: string) => Promise<string | undefined>;
  verifyResetCode: (email: string, code: string) => Promise<boolean>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  clearResetState: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,
      resetEmail: null,
      resetCodeVerified: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.login({ email, password });
          apiClient.setToken(response.accessToken);
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
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
          apiClient.setToken(response.accessToken);
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '注册失败';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await apiClient.logout(refreshToken);
          }
        } catch {
          // Ignore logout API errors
        }
        apiClient.setToken(null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const response = await apiClient.refreshToken({ refreshToken });
          apiClient.setToken(response.accessToken);
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          return true;
        } catch {
          // Refresh failed, clear auth state
          apiClient.setToken(null);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      initialize: async () => {
        const initTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Init timeout')), 5000)
        );

        try {
          const { accessToken, refreshToken } = get();
          if (accessToken) {
            apiClient.setToken(accessToken);
            try {
              const user = await Promise.race([apiClient.getMe(), initTimeout]);
              set({ user, isAuthenticated: true, isInitialized: true });
            } catch {
              // Access token invalid, try refresh
              if (refreshToken) {
                const refreshed = await get().refreshAccessToken();
                if (refreshed) {
                  try {
                    const user = await Promise.race([apiClient.getMe(), initTimeout]);
                    set({ user, isAuthenticated: true, isInitialized: true });
                    return;
                  } catch {
                    // Still failed after refresh
                  }
                }
              }
              // Clear state on failure
              apiClient.setToken(null);
              set({
                accessToken: null,
                refreshToken: null,
                user: null,
                isAuthenticated: false,
                isInitialized: true,
              });
            }
          } else {
            set({ isInitialized: true });
          }
        } catch (error) {
          console.error('Auth init error:', error);
          set({ isInitialized: true });
        }
      },

      // Password reset methods
      sendResetCode: async (email) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.forgotPassword({ email });
          set({ resetEmail: email, isLoading: false });
          // In dev mode, backend returns the code for testing
          return response.code;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '发送验证码失败';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      verifyResetCode: async (email, code) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.verifyResetCode({ email, code });
          set({ resetCodeVerified: response.valid, isLoading: false });
          return response.valid;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '验证码验证失败';
          set({ error: message, isLoading: false, resetCodeVerified: false });
          throw error;
        }
      },

      resetPassword: async (email, code, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.resetPassword({ email, code, newPassword });
          set({ isLoading: false, resetEmail: null, resetCodeVerified: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '重置密码失败';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      clearResetState: () => {
        set({ resetEmail: null, resetCodeVerified: false, error: null });
      },

      clearError: () => set({ error: null }),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandSecureStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
