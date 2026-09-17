// ============================================================
// RUSH PERFORMANCE — Mobile Bottom Navigation
// Editorial sports navigation matching rushperformance.com.br
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Activity, Dumbbell, User, Users } from 'lucide-react';

// Os caminhos têm de existir em SHELL_PATHS (src/App.jsx). Dois aqui
// não existiam — '/training' e '/profile' — e o catch-all do roteador
// mandava os dois para a Início sem dizer nada: o botão "Treino"
// levava para a home, e o "Perfil" também. Quem só vê a tela conclui
// que o app travou, não que a rota está errada.
const tabs = [
  { path: '/', icon: Home, label: 'Início', id: 'nav-home' },
  { path: '/feed', icon: Activity, label: 'Feed', id: 'nav-feed' },
  { path: '/treinos', icon: Dumbbell, label: 'Treino', id: 'nav-training' },
  { path: '/coach', icon: Users, label: 'Assessoria', id: 'nav-coach' },
  { path: '/perfil', icon: User, label: 'Perfil', id: 'nav-profile' },
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
