import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { HealthProvider } from '../context/HealthContext.jsx';
import { apiRequest } from '../lib/api.js';

const health = { status: 'ok', phase: 1, timestamp: new Date().toISOString(), database: { status: 'disconnected', configured: false }, realtime: { status: 'initialized' } };
const user = { id: 'test-user', name: 'Test Student', role: 'student', email: 'test@example.edu', isActive: true };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function mockApi({ signedIn = true, offline = false } = {}) {
  const fetchMock = vi.fn(async (url) => {
    if (url.endsWith('/auth/me')) return signedIn ? response({ user }) : response({ error: { message: 'Please sign in.' } }, 401);
    if (url.endsWith('/health')) { if (offline) throw new Error('Offline'); return response(health); }
    if (url.endsWith('/auth/login')) return response({ user });
    if (url.endsWith('/student/dashboard')) return response({ counts: { projects: 0, pendingProposals: 0, approvedProjects: 0, pendingSubmissions: 0 }, projects: [], activity: [], notifications: [] });
    if (url.includes('/projects')) return response({ projects: [] });
    if (url.includes('/submissions')) return response({ submissions: [] });
    if (url.endsWith('/evaluations/config')) return response({ configured: false });
    return response({ evaluations: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
function mount(path = '/foundation') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><HealthProvider><App /></HealthProvider></AuthProvider></MemoryRouter>);
}

describe('authenticated workspace', () => {
  it('preserves the foundation with honest database status and working role navigation', async () => {
    mockApi(); mount();
    expect(await screen.findByRole('heading', { level: 1, name: /Great projects start here/ })).toBeInTheDocument();
    expect(await screen.findByText('Setup required')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'AI Evaluation', exact: true }));
    expect(await screen.findByRole('heading', { name: 'AI-assisted evaluation', exact: true })).toBeInTheDocument();
  });
  it('preserves backend health failure and retry feedback', async () => {
    const fetchMock = mockApi({ offline: true }); mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not reach the backend');
    fetchMock.mockImplementation(async (url) => url.endsWith('/health') ? response(health) : response({ user }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Setup required')).toBeInTheDocument();
  });
  it('preserves the not-found page', async () => {
    mockApi(); mount('/no-such-page');
    expect(await screen.findByRole('heading', { name: 'This path is still unwritten.' })).toBeInTheDocument();
  });
  it('redirects unauthenticated visitors and performs a cookie-based login', async () => {
    const fetchMock = mockApi({ signedIn: false }); mount('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@example.edu' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true })));
    expect(await screen.findByRole('heading', { name: 'Welcome, Test.' })).toBeInTheDocument();
    const loginCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/login'));
    expect(loginCall[1].credentials).toBe('include');
    expect(window.localStorage.getItem('fyp.accessToken')).toBeNull();
  });
  it('redirects a student away from admin pages', async () => {
    mockApi(); mount('/admin/students');
    expect(await screen.findByRole('heading', { name: 'Welcome, Test.' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'My Projects', exact: true })).toBeInTheDocument());
  });
  it('normalizes API errors and adds the CSRF request header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { code: 'FORBIDDEN', message: 'Permission denied.' } }, 403));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/private')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(fetchMock.mock.calls[0][1].headers.get('X-FYP-Request')).toBe('1');
  });
});
