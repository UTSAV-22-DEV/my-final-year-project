import { NavLink } from 'react-router-dom';
import { ArrowUpRight, GraduationCap, Layers3, X } from 'lucide-react';
import { navigation, roleNavigation, settingsNavigation } from '../lib/navigation.js';
import { useAuth } from '../context/AuthContext.jsx';

function SidebarLink({ item, onNavigate }) {
  const Icon = item.icon;
  return <NavLink to={item.path} end={item.path === '/'} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></NavLink>;
}

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const items = user ? roleNavigation(user.role) : navigation;
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation overlay" onClick={onClose} tabIndex={-1} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Workspace navigation">
        <NavLink to="/" className="brand" onClick={onClose} aria-label="FYP Workspace home">
          <span className="brand-mark"><GraduationCap size={26} aria-hidden="true" /></span>
          <span>FYP<span className="brand-subtitle">WORKSPACE</span></span>
        </NavLink>
        <button className="icon-button mobile-close" aria-label="Close navigation" onClick={onClose}><X size={20} /></button>
        <div className="workspace-selector"><span className="workspace-initial">A</span><div><strong>Academic workspace</strong><span>Final year projects</span></div><Layers3 size={15} aria-hidden="true" /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">{items.map((item) => <SidebarLink key={item.path} item={item} onNavigate={onClose} />)}</nav>
        <div className="sidebar-bottom">
          <div className="foundation-card"><span className="foundation-symbol"><Layers3 size={18} aria-hidden="true" /></span><strong>A strong start.</strong><p>Your project workspace, one thoughtful step at a time.</p><NavLink to="/settings" onClick={onClose}>Explore the foundation <ArrowUpRight size={14} aria-hidden="true" /></NavLink></div>
          <SidebarLink item={settingsNavigation} onNavigate={onClose} />
          <div className="sidebar-footer"><span className="status-dot green" />Academic workspace <span>Connected</span></div>
        </div>
      </aside>
    </>
  );
}
