import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiPost, apiGet } from '../api/client';
import type { AuthUser, LoginResponse } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, companyName: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('squidjob_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      apiGet<{ user: AuthUser }>('/auth/me')
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem('squidjob_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem('squidjob_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, companyName: string) => {
    const data = await apiPost<LoginResponse>('/auth/register', { email, password, name, companyName });
    localStorage.setItem('squidjob_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('squidjob_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
