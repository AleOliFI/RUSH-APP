// ============================================================
// RUSH PERFORMANCE — App Root & Route Setup
// ============================================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Feed from './pages/Feed';
import Training from './pages/Training';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';

function ProtectedRoute({ children, requireOnboarding = true }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--accent-primary)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.1em' }}>
          RUSH
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOnboarding && !user?.has_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    if (!user?.has_onboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

function BottomNavWrapper() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const hideNavOn = ['/login', '/register', '/onboarding'];
  if (!isAuthenticated || hideNavOn.includes(location.pathname)) {
    return null;
  }

  return <BottomNav />;
}

function AppRoutes() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login mode="login" />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Login mode="register" />
            </PublicRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute requireOnboarding={false}>
              <Onboarding user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <Feed user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/training"
          element={
            <ProtectedRoute>
              <Training user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNavWrapper />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
