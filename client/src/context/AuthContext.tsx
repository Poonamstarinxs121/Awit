import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiPost, apiGet } from '../api/client';
import type { AuthUser, LoginResponse, RegisterResponse, MeResponse } from '../types';

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

  const fetchMe = useCallback(async () => {
    const data = await apiGet<MeResponse>('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe()
        .catch(() => {
          localStorage.removeItem('squidjob_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem('squidjob_token', data.token);
    setToken(data.token);
    const meData = await apiGet<MeResponse>('/auth/me');
    setUser(meData.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, companyName: string) => {
    const data = await apiPost<RegisterResponse>('/auth/register', { email, password, name, companyName });
    localStorage.setItem('squidjob_token', data.token);
    setToken(data.token);
    const meData = await apiGet<MeResponse>('/auth/me');
    setUser(meData.user);
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
