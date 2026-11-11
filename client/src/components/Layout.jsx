import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const { pathname } = useLocation();
  const { error } = useAuth();
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') closeSidebar(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeSidebar]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="main-shell"><Header onMenuClick={() => setSidebarOpen(true)} />
        {error && <div className="session-notice" role="alert">{error}</div>}
        <main id="main-content" className="main-content"><Outlet /></main>
        <footer className="page-footer"><span>AI-Assisted Final Year Project Management System</span><span>Built for progress. Guided by people.</span></footer>
      </div>
    </div>
  );
}
