import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const HealthContext = createContext(null);

export function HealthProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => { setLoading(true); setRevision((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/health', { signal: controller.signal })
      .then((result) => { setData(result); setError(null); })
      .catch(() => {
        if (controller.signal.aborted) return;
        setData(null);
        setError('We could not reach the backend. Start the server, then try again.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  return <HealthContext.Provider value={{ data, loading, error, refresh }}>{children}</HealthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) throw new Error('useHealth requires HealthProvider.');
  return context;
}
