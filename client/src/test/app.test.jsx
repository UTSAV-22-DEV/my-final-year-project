import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App.jsx';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import { HealthProvider } from '../context/HealthContext.jsx';
import { apiRequest } from '../lib/api.js';

const health = { status: 'ok', phase: 1, timestamp: new Date().toISOString(), database: { status: 'disconnected', configured: false }, realtime: { status: 'initialized' } };
function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><HealthProvider><App /></HealthProvider></AuthProvider></MemoryRouter>);
}

describe('workspace foundation', () => {
  it('shows live API status and an honest disconnected database state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => health }));
    mount();
    expect(screen.getByRole('heading', { level: 1, name: /Great projects start here/ })).toBeInTheDocument();
    expect(await screen.findByText('Setup required')).toBeInTheDocument();
    expect(screen.getByText('MongoDB is not connected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'AI evaluations' }));
    expect(screen.getByRole('heading', { level: 1, name: 'AI evaluations' })).toBeInTheDocument();
    expect(screen.getByText(/Two AI-assisted attempts/)).toBeInTheDocument();
    expect(screen.getByText(/reserved for a later phase/)).toBeInTheDocument();
  });

  it('renders a useful error and retries failed health requests', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ok: true, status: 200, json: async () => health });
    vi.stubGlobal('fetch', fetchMock);
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not reach the backend');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Setup required')).toBeInTheDocument();
  });

  it('shows the not-found page for an unknown route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => health }));
    mount('/no-such-page');
    expect(screen.getByRole('heading', { name: 'This path is still unwritten.' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('API connected')).toBeInTheDocument());
  });

  it('clears an expired stored session after the API rejects it', async () => {
    window.localStorage.setItem('fyp.accessToken', 'expired-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Expired' } }) }));
    function SessionProbe() { const auth = useAuth(); return <div>{auth.loading ? 'Checking' : auth.token ? 'Session retained' : 'Signed out'}</div>; }
    await act(async () => { render(<AuthProvider><SessionProbe /></AuthProvider>); });
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(window.localStorage.getItem('fyp.accessToken')).toBeNull();
  });

  it('normalizes API errors and sends bearer tokens explicitly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: { code: 'FORBIDDEN', message: 'Permission denied.' } }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/private', { token: 'test-token' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token');
  });
});
