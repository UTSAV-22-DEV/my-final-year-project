import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);

  const clearSession = useCallback(() => {
    try { window.localStorage.removeItem('fyp.accessToken'); } catch { /* Legacy storage may be blocked. */ }
    setUser(null);
    setLoading(false);
    setError(null);
  }, []);

  const refreshSession = useCallback(() => { setLoading(true); setRevision((value) => value + 1); }, []);

  useEffect(() => {
    try { window.localStorage.removeItem('fyp.accessToken'); } catch { /* Clear the Phase 1 token slot. */ }
    const controller = new AbortController();
    apiRequest('/auth/me', { signal: controller.signal })
      .then((result) => { setUser(result.user); setError(null); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) clearSession();
        else setError('Your session could not be verified. Please try again later.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, clearSession]);

  useEffect(() => {
    window.addEventListener('fyp:unauthorized', clearSession);
    return () => window.removeEventListener('fyp:unauthorized', clearSession);
  }, [clearSession]);

  const authenticate = async (operation, values) => {
    const result = await apiRequest(`/auth/${operation}`, { method: 'POST', body: JSON.stringify(values) });
    setUser(result.user);
    setError(null);
    return result.user;
  };
  const login = (values) => authenticate('login', values);
  const register = (values) => authenticate('register', values);
  const logout = async () => {
    try { await apiRequest('/auth/logout', { method: 'POST' }); clearSession(); }
    catch { setError('Sign-out could not be completed. Please try again.'); }
  };

  return <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshSession }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider.');
  return context;
}
