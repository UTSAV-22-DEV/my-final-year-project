const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-FYP-Request', '1');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const timeout = AbortSignal.timeout(6000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(`${apiBase}${path}`, { ...options, headers, signal, credentials: 'include' });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !['/auth/login', '/auth/register'].includes(path)) window.dispatchEvent(new Event('fyp:unauthorized'));
    throw new ApiError(body?.error?.message || 'The request could not be completed.', response.status, body?.error?.code);
  }
  if (!body) throw new ApiError('The server returned an unexpected response.', response.status, 'INVALID_RESPONSE');
  return body;
}
