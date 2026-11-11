import { Link, useLocation } from 'react-router-dom';
import { Bell, ChevronRight, Menu, LogOut } from 'lucide-react';
import { navigation, roleNavigation, settingsNavigation } from '../lib/navigation.js';
import { useHealth } from '../context/HealthContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const { data, loading } = useHealth();
  const { user, logout } = useAuth();
  const item = [...(user ? roleNavigation(user.role) : navigation), settingsNavigation].find((entry) => entry.path === pathname);
  return (
    <header className="header">
      <div className="header-left"><button className="icon-button mobile-menu" onClick={onMenuClick} aria-label="Open navigation"><Menu size={22} /></button><span className="breadcrumb-parent">Workspace</span><ChevronRight size={14} className="breadcrumb-chevron" aria-hidden="true" /><span>{item?.label || 'Page not found'}</span></div>
      <div className="header-actions">
        <Link to="/settings" className="connection-chip"><span className={`status-dot ${loading ? 'muted' : data ? 'green' : 'amber'}`} />{loading ? 'Checking services' : data ? 'API connected' : 'API unavailable'}</Link>
        <Link className="icon-button notification-button" to={`/${user?.role}/notifications`} aria-label="View notifications"><Bell size={19} /></Link>
        <div className="header-divider" />
        <div className="identity"><div className="avatar">{user ? user.name.slice(0, 2).toUpperCase() : 'FW'}</div><div><strong>{user?.name || 'Workspace preview'}</strong><span>{user?.role || 'Foundation access'}</span></div></div>
        <button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  );
}
