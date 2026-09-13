import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps a route: requires login, and optionally restricts to specific roles.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;

  return children;
}
