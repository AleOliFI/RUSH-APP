// ============================================================
// RUSH RUNNING — App Root & Route Setup
// ------------------------------------------------------------
// Área pública: Login / Registro / Onboarding.
// Área autenticada: RushShell (6 abas do novo design system).
// O painel da assessoria (/coach) permanece na estrutura antiga.
// ============================================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import CoachDashboard from './pages/CoachDashboard';
import BottomNav from './components/BottomNav';
import RushShell from './RushShell';

/** Rotas do shell novo — tudo o que não for pública nem /coach cai aqui. */
const SHELL_PATHS = ['/', '/medicao', '/treinos', '/feed', '/pro', '/perfil'];

function ProtectedRoute({ children, requireOnboarding = true }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="font-headline text-2xl text-[#FF5500] uppercase tracking-widest animate-pulse">RUSH</div>
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

function AppRoutes() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // O shell novo traz a própria navegação inferior; a barra antiga fica
  // restrita ao painel da assessoria, que ainda usa o design system legado.
  const showLegacyNav = location.pathname === '/coach';

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
          path="/coach"
          element={
            <ProtectedRoute>
              <CoachDashboard user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />

        {SHELL_PATHS.map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <RushShell onLogout={logout} />
              </ProtectedRoute>
            }
          />
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showLegacyNav && <BottomNav />}
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
