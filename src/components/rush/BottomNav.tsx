import React from 'react';
import { TabType } from '../../types';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  isMeasuring?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  isMeasuring = false,
}) => {
  return (
    <nav
      aria-label="Navegação Principal"
      className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-[#262626] shadow-[0_-4px_20px_rgba(0,0,0,0.7)]"
    >
      <div className="max-w-md mx-auto grid grid-cols-6 items-center h-16 px-1">
        {/* Tab 1: Início */}
        <button
          onClick={() => onTabChange('inicio')}
          className={`group flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 cursor-pointer active:scale-95 ${
            currentTab === 'inicio' ? 'text-[#FF5500]' : 'text-[#A1A1AA] hover:text-[#f4f4f5]'
          }`}
          data-path="inicio"
          aria-label="Início"
        >
          <span
            className={`material-symbols-outlined text-[22px] transition-transform ${
              currentTab === 'inicio' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,85,0,0.5)]' : 'group-hover:text-[#FF5500]'
            }`}
          >
            speed
          </span>
          <span
            className={`font-label-caps text-[10px] tracking-wider uppercase mt-0.5 truncate transition-colors ${
              currentTab === 'inicio' ? 'text-[#FF5500] font-bold' : 'group-hover:text-[#f4f4f5]'
            }`}
          >
            Início
          </span>
        </button>

        {/* Tab 2: Medição */}
        <button
          onClick={() => onTabChange('medicao')}
          className={`group flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 relative cursor-pointer active:scale-95 ${
            currentTab === 'medicao' ? 'text-[#FF5500]' : 'text-[#A1A1AA] hover:text-[#f4f4f5]'
          }`}
          data-path="medicao"
          aria-label="Medição"
        >
          <div className="relative flex items-center justify-center">
            <span
              className={`material-symbols-outlined text-[22px] transition-all duration-200 ${
                currentTab === 'medicao' || isMeasuring
                  ? 'text-[#FF5500] drop-shadow-[0_0_10px_rgba(255,85,0,0.7)] scale-110'
                  : 'group-hover:text-[#FF5500]'
              }`}
            >
              ecg_heart
            </span>
            {isMeasuring && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF5500] animate-ping" />
            )}
          </div>
          <span
            className={`font-label-caps text-[10px] tracking-wider uppercase mt-0.5 truncate transition-colors ${
              currentTab === 'medicao' ? 'text-[#FF5500] font-bold' : 'group-hover:text-[#f4f4f5]'
            }`}
          >
            Medição
          </span>
        </button>

        {/* Tab 3: Treinos */}
        <button
          onClick={() => onTabChange('treinos')}
          className={`group flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 cursor-pointer active:scale-95 ${
            currentTab === 'treinos' ? 'text-[#FF5500]' : 'text-[#A1A1AA] hover:text-[#f4f4f5]'
          }`}
          data-path="treinos"
          aria-label="Treinos"
        >
          <span
            className={`material-symbols-outlined text-[22px] transition-transform ${
              currentTab === 'treinos' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,85,0,0.5)]' : 'group-hover:text-[#FF5500]'
            }`}
          >
            bolt
          </span>
          <span
            className={`font-label-caps text-[10px] tracking-wider uppercase mt-0.5 truncate transition-colors ${
              currentTab === 'treinos' ? 'text-[#FF5500] font-bold' : 'group-hover:text-[#f4f4f5]'
            }`}
          >
            Treinos
          </span>
        </button>

        {/* Tab 4: Feed */}
        <button
          onClick={() => onTabChange('feed')}
          className={`group flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 cursor-pointer active:scale-95 ${
            currentTab === 'feed' ? 'text-[#FF5500]' : 'text-[#A1A1AA] hover:text-[#f4f4f5]'
          }`}
          data-path="feed"
          aria-label="Feed"
        >
          <span
            className={`material-symbols-outlined text-[22px] transition-transform ${
              currentTab === 'feed' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,85,0,0.5)]' : 'group-hover:text-[#FF5500]'
            }`}
          >
            local_fire_department
          </span>
          <span
            className={`font-label-caps text-[10px] tracking-wider uppercase mt-0.5 truncate transition-colors ${
              currentTab === 'feed' ? 'text-[#FF5500] font-bold' : 'group-hover:text-[#f4f4f5]'
            }`}
          >
            Feed
          </span>
        </button>

        {/* Tab 5: PRO */}
        <button
          onClick={() => onTabChange('premium-pro')}
          className={`group flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 relative cursor-pointer active:scale-95 ${
            currentTab === 'premium-pro' ? 'text-[#FACC15]' : 'text-[#A1A1AA] hover:text-[#f4f4f5]'
          }`}
          data-path="premium-pro"
          aria-label="PRO"
        >
          <div className="relative flex items-center justify-center">
            <span
              className={`material-symbols-outlined text-[22px] transition-transform ${
                currentTab === 'premium-pro'
                  ? 'text-[#FACC15] scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                  : 'group-hover:text-[#FACC15]'
              }`}
            >
              workspace_premium
            </span>
            <span className="absolute -top-1.5 -right-3.5 bg-[#FF5500] text-[#0D0D0D] font-telemetry text-[9px] font-black px-1 rounded-xs tracking-tighter leading-tight uppercase">
              PRO
            </span>
          </div>
          <span
            className={`font-label-caps text-[10px] tracking-wider uppercase mt-0.5 truncate transition-colors ${
              currentTab === 'premium-pro' ? 'text-[#FACC15] font-bold' : 'group-hover:text-[#f4f4f5]'
            }`}
          >
            PRO
          </span>
        </button>

        {/* Tab 6: Perfil */}
        <button
          onClick={() => onTabChange('perfil')}
          className={`group flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 cursor-pointer active:scale-95 ${
            currentTab === 'perfil' ? 'text-[#FF5500]' : 'text-[#A1A1AA] hover:text-[#f4f4f5]'
          }`}
          data-path="perfil"
          aria-label="Perfil"
        >
          <span
            className={`material-symbols-outlined text-[22px] transition-transform ${
              currentTab === 'perfil' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,85,0,0.5)]' : 'group-hover:text-[#FF5500]'
            }`}
          >
            person
          </span>
          <span
            className={`font-label-caps text-[10px] tracking-wider uppercase mt-0.5 truncate transition-colors ${
              currentTab === 'perfil' ? 'text-[#FF5500] font-bold' : 'group-hover:text-[#f4f4f5]'
            }`}
          >
            Perfil
          </span>
        </button>
      </div>
    </nav>
  );
};
