import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import HeadDashboard from './pages/head/HeadDashboard';
import Dashboard from './pages/shared/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route
              path="/head/dashboard"
              element={
                <ProtectedRoute allowedRoles={['HEAD']}>
                  <HeadDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app/dashboard"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'VENDOR']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
