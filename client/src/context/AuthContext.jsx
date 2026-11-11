import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);
const tokenKey = 'fyp.accessToken';

function storedToken() {
  try { return window.localStorage.getItem(tokenKey); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(null);

  const clearSession = useCallback(() => {
    try { window.localStorage.removeItem(tokenKey); } catch { /* Storage may be blocked. */ }
    setToken(null);
    setUser(null);
    setLoading(false);
    setError(null);
  }, []);

  // The later sign-in flow passes its JWT here. No client-supplied role is trusted.
  const acceptSession = useCallback((accessToken) => {
    try { window.localStorage.setItem(tokenKey, accessToken); } catch { /* Session can remain in memory. */ }
    setLoading(true);
    setUser(null);
    setToken(accessToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    apiRequest('/auth/me', { token, signal: controller.signal })
      .then((result) => { setUser(result.user); setError(null); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) clearSession();
        else setError('Your session could not be verified. Please try again later.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, clearSession]);

  return <AuthContext.Provider value={{ user, token, loading, error, acceptSession, clearSession }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider.');
  return context;
}
