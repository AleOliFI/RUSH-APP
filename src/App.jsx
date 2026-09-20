// ============================================================
// RUSH RUNNING — App Root & Route Setup
// ------------------------------------------------------------
// Área pública: Login / Registro / Onboarding.
// Área autenticada: RushShell (6 abas do novo design system).
//
// O painel da assessoria era uma segunda implementação da mesma
// funcionalidade, no design system antigo, servida por /coach. O
// módulo dentro do RushShell (Perfil → treinador) faz tudo o que ele
// fazia e mais — inclusive convite por e-mail, que o antigo nunca
// teve —, então ele saiu junto com a barra inferior legada, que só
// existia para servi-lo. /coach agora redireciona para /perfil, para
// quem tiver o link salvo não cair em lugar nenhum.
// ============================================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import RushShell from './RushShell';

/** Rotas do shell novo — tudo o que não for pública cai aqui. */
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
  const { user, logout, login, register, updateUser, refreshUser } = useAuth();

  return (
    <div className="app-shell">
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginScreen mode="login" onLogin={login} onRegister={register} />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <LoginScreen mode="register" onLogin={login} onRegister={register} />
            </PublicRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute requireOnboarding={false}>
              <OnboardingScreen user={user} onUpdateUser={updateUser} onRefreshUser={refreshUser} />
            </ProtectedRoute>
          }
        />
        {/* O painel legado saiu; o módulo do treinador vive em Perfil. */}
        <Route path="/coach" element={<Navigate to="/perfil" replace />} />

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
