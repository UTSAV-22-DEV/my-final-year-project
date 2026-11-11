import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, LoaderCircle } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { DateLabel } from './WorkspaceUI.jsx';

export function NotificationBell() {
  const notifications = useNotifications(); const { user } = useAuth(); const [open, setOpen] = useState(false); const [failure, setFailure] = useState('');
  const container = useRef(null);
  useEffect(() => {
    const close = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return <div className="notification-bell" ref={container}><button className="icon-button notification-button" aria-label={`Notifications, ${notifications.unreadCount} unread`} aria-expanded={open} aria-controls="notification-preview" onClick={() => setOpen(!open)}><Bell size={19} aria-hidden="true" />{notifications.unreadCount > 0 && <span className="notification-count" data-testid="unread-count">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>}</button>{open && <section id="notification-preview" className="notification-dropdown" aria-label="Latest notifications"><div className="notification-dropdown-heading"><strong>Notifications</strong><span className={`status-dot ${notifications.connected ? 'green' : 'amber'}`} title={notifications.connected ? 'Live updates connected' : 'Reconnecting'} /></div>{failure && <p className="form-error" role="alert">{failure}</p>}{notifications.error && <p className="form-error" role="alert">{notifications.error}</p>}{notifications.loading && !notifications.items.length ? <div className="dropdown-empty"><LoaderCircle size={17} className="spin" /></div> : !notifications.items.length ? <p className="dropdown-empty">You're all caught up.</p> : <div className="dropdown-list">{notifications.items.map((record) => <article className={record.readAt ? '' : 'is-unread'} key={record._id}><button className="notification-open" onClick={async () => { if (await notifications.openNotification(record)) setOpen(false); }}><strong>{record.title}</strong><span>{record.message}</span><DateLabel value={record.createdAt} /></button>{!record.readAt && <button className="icon-button" aria-label={`Mark as read: ${record.title}`} onClick={async () => { try { await notifications.markRead(record._id); } catch { setFailure('This update could not be marked as read.'); } }}><Check size={16} /></button>}</article>)}</div>}<Link className="view-all-notifications" to={`/${user.role}/notifications`} onClick={() => setOpen(false)}>View all notifications →</Link></section>}</div>;
}
