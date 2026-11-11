import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from './LoadingState.jsx';
import { ErrorState } from './ErrorState.jsx';

export function ProtectedRoute({ roles }) {
  const { user, loading, error, refreshSession } = useAuth();
  const location = useLocation();
  if (loading) return <div className="session-screen"><LoadingState label="Restoring your session…" /></div>;
  if (!user && error) return <div className="session-screen"><ErrorState message={error} onRetry={refreshSession} /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return <Outlet />;
}
