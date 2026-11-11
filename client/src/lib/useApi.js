import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api.js';

export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    apiRequest(path, { signal: controller.signal }).then((result) => { setData(result); setError(null); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || 'The service could not be reached.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  useEffect(() => {
    window.addEventListener('fyp:data-changed', refresh);
    const receivesNotifications = path.includes('/notifications') || path.endsWith('/dashboard');
    if (receivesNotifications) window.addEventListener('fyp:notifications-changed', refresh);
    return () => { window.removeEventListener('fyp:data-changed', refresh); window.removeEventListener('fyp:notifications-changed', refresh); };
  }, [path, refresh]);
  return { data, loading, error, refresh };
}

export function dataChanged() { window.dispatchEvent(new Event('fyp:data-changed')); }
