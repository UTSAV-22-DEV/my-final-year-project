import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { apiRequest } from '../lib/api.js';

const NotificationContext = createContext(null);
const changed = () => window.dispatchEvent(new Event('fyp:notifications-changed'));
const projectId = (record) => record.project?._id || record.project;

export function NotificationProvider({ children }) {
  const { user, refreshSession } = useAuth(); const userId = user?.id; const navigate = useNavigate();
  const [items, setItems] = useState([]); const [unreadCount, setUnreadCount] = useState(0);
  const [owner, setOwner] = useState(null); const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const epoch = useRef(0); const sequence = useRef(0); const abort = useRef(null); const seen = useRef(new Set());
  const refresh = useCallback(async () => {
    if (!userId) return;
    const currentEpoch = epoch.current; const currentSequence = ++sequence.current;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        apiRequest('/notifications?limit=5', { signal: abort.current?.signal }),
        apiRequest('/notifications/unread-count', { signal: abort.current?.signal }),
      ]);
      if (currentEpoch !== epoch.current || currentSequence !== sequence.current) return;
      setOwner(userId); setItems(list.notifications); setUnreadCount(count.unreadCount); setError('');
      list.notifications.forEach((item) => seen.current.add(item._id));
    } catch {
      if (currentEpoch === epoch.current && !abort.current?.signal.aborted) setError('Notifications could not be refreshed. Reconnect or try again.');
    } finally { if (currentEpoch === epoch.current && currentSequence === sequence.current) setLoading(false); }
  }, [userId]);

  useEffect(() => {
    epoch.current++; seen.current = new Set(); setConnected(false); setItems([]); setUnreadCount(0); setOwner(userId || null); setError('');
    if (!userId) return;
    const currentEpoch = epoch.current; const controller = new AbortController(); abort.current = controller;
    refresh();
    const base = import.meta.env.VITE_API_BASE_URL;
    const socketOrigin = base?.startsWith('http') ? new URL(base).origin : undefined;
    const socket = io(socketOrigin, { withCredentials: true, reconnection: true });
    socket.on('connect', () => { if (epoch.current === currentEpoch) { setConnected(true); refresh(); changed(); } });
    socket.on('notification', (record) => {
      if (epoch.current !== currentEpoch || String(record.recipient) !== userId) return;
      if (!seen.current.has(record._id)) {
        seen.current.add(record._id);
        setItems((current) => [record, ...current.filter((item) => item._id !== record._id)].slice(0, 5));
        if (!record.readAt) setUnreadCount((count) => count + 1);
      }
      refresh(); changed();
    });
    socket.on('notifications:changed', () => { refresh(); changed(); });
    socket.on('disconnect', (reason) => {
      if (epoch.current !== currentEpoch) return;
      setConnected(false);
      if (reason === 'io server disconnect') refreshSession();
    });
    socket.on('connect_error', (failure) => {
      if (epoch.current !== currentEpoch) return;
      setConnected(false);
      if (failure.message === 'Authentication required.') window.dispatchEvent(new Event('fyp:unauthorized'));
    });
    return () => { epoch.current = currentEpoch + 1; controller.abort(); socket.disconnect(); };
  }, [userId, refresh, refreshSession]);

  const markRead = async (id) => {
    const result = await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
    setItems((current) => current.map((item) => item._id === id ? { ...item, readAt: result.notification.readAt } : item));
    setUnreadCount(result.unreadCount); refresh(); changed();
  };
  const markAllRead = async () => { await apiRequest('/notifications/read-all', { method: 'PATCH' }); await refresh(); changed(); };
  const remove = async (id) => { await apiRequest(`/notifications/${id}`, { method: 'DELETE' }); await refresh(); changed(); };
  const openNotification = async (record) => {
    setError('');
    try {
      await markRead(record._id);
      const id = projectId(record);
      if (id) await apiRequest(`/projects/${id}`);
      const root = `/${user.role}`;
      const type = record.resourceType || record.type;
      const target = ['evaluation', 'grade'].includes(type) ? `${root}/evaluations?project=${id}`
        : type === 'submission' && record.resourceId ? `${root}/documents/${record.resourceId}`
          : ['proposal', 'feedback', 'resource'].includes(type) ? `${root}/${{ proposal: 'proposals', feedback: 'feedback', resource: 'resources' }[type]}?project=${id}`
            : id ? `${root}/projects/${id}` : `${root}/dashboard`;
      navigate(target);
      return true;
    } catch { setError('This update could not be opened. You may no longer have access to the referenced project.'); return false; }
  };
  return <NotificationContext.Provider value={{ items: owner === userId ? items : [], unreadCount: owner === userId ? unreadCount : 0, connected, loading, error, refresh, markRead, markAllRead, remove, openNotification }}>{children}</NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications requires NotificationProvider.');
  return context;
}
