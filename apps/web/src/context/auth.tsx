import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, AuthTokens } from '@stillalive/types';
import { HttpClient, AuthApi } from '@stillalive/api';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (tokens: AuthTokens, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  api: HttpClient;
  authApi: AuthApi;
}

const TOKEN_KEY = 'sa-access-token';
const REFRESH_KEY = 'sa-refresh-token';

const httpClient = new HttpClient({
  baseUrl: '/api',
  getToken: () => localStorage.getItem(TOKEN_KEY),
  onTokenExpired: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.location.href = '/login';
  },
});

const authApi = new AuthApi(httpClient);

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState({ user: null, loading: false });
      return;
    }
    authApi.me().then(res => {
      setState({ user: res.data, loading: false });
    }).catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      setState({ user: null, loading: false });
    });
  }, []);

  const login = useCallback((tokens: AuthTokens, user: User) => {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    setState({ user, loading: false });
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    authApi.logout().catch(() => {});
    if (refreshToken) {
      localStorage.removeItem(REFRESH_KEY);
    }
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, loading: false });
  }, []);

  const updateUser = useCallback((user: User) => {
    setState(prev => ({ ...prev, user }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, api: httpClient, authApi }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
