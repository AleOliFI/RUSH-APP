// ============================================================
// RUSH PERFORMANCE — Mobile Bottom Navigation
// Editorial sports navigation matching rushperformance.com.br
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Activity, Dumbbell, User } from 'lucide-react';

const tabs = [
  { path: '/', icon: Home, label: 'Início', id: 'nav-home' },
  { path: '/feed', icon: Activity, label: 'Feed', id: 'nav-feed' },
  { path: '/training', icon: Dumbbell, label: 'Treino', id: 'nav-training' },
  { path: '/profile', icon: User, label: 'Perfil', id: 'nav-profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  if (['/onboarding', '/login', '/register'].includes(location.pathname)) {
    return null;
  }

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`nav-item${isActive ? ' active' : ''}`}
            onClick={() => navigate(tab.path)}
            aria-current={isActive ? 'page' : undefined}
            id={tab.id}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
