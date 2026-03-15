import { useState, useEffect, useCallback } from 'react';
import { getToken, getRole, clearAuth, login as apiLogin } from '../lib/api';

export function useAuth() {
  const [token, setToken] = useState<string | null>(getToken);
  const [role, setRole] = useState<'player' | 'admin' | null>(getRole);

  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setRole(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (password: string, loginRole: 'player' | 'admin') => {
    const data = await apiLogin(password, loginRole);
    setToken(data.token);
    setRole(data.role);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setRole(null);
  }, []);

  const isAuthenticated = !!token;
  const isAdmin = role === 'admin';
  const isPlayer = role === 'player' || role === 'admin';

  return { token, role, isAuthenticated, isAdmin, isPlayer, login, logout };
}
