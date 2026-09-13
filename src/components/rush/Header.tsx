import React from 'react';
import { APP_IMAGES } from '../../data/appAssets';
import { Avatar } from './Avatar';
import { AthleteProfile, PhysiologicalReadiness } from '../../types';

interface HeaderProps {
  athlete: AthleteProfile;
  readiness: PhysiologicalReadiness;
  onOpenProfile: () => void;
  onStartMeasure: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  athlete,
  readiness,
  onOpenProfile,
  onStartMeasure,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#0D0D0D]/90 backdrop-blur-xl pt-safe border-b border-[#262626]/80 shadow-[0_1px_12px_rgba(0,0,0,0.5)]">
      <div className="max-w-2xl mx-auto h-16 px-5 flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img
              alt="RUSH RUNNING PRO"
              className="h-7 w-auto object-contain select-none"
              src={APP_IMAGES.logo}
              onError={(e) => {
                // Fallback SVG if network throttled
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.svg-fallback')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'svg-fallback flex items-center gap-2 font-headline text-2xl text-[#FF5500] tracking-tighter';
                  fallback.innerHTML = `
                    <div class="flex items-center space-x-1">
                      <span class="w-2.5 h-6 bg-[#FF5500] skew-x-[-20deg] inline-block"></span>
                      <span class="w-2.5 h-6 bg-[#FF6B00] skew-x-[-20deg] inline-block"></span>
                      <span class="w-2.5 h-6 bg-[#FFAA00] skew-x-[-20deg] inline-block"></span>
                    </div>
                    <span class="text-white ml-1">RUSH</span>
                    <span class="text-xs bg-[#FF5500] text-black px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">PRO</span>
                  `;
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
        </div>

        {/* Telemetry Status and Profile trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onStartMeasure}
            title="Clique para realizar teste matinal"
            className="text-right flex flex-col items-end hover:opacity-85 transition-opacity cursor-pointer group"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  athlete.status === 'UNKNOWN' ? 'bg-[#737373]' : 'bg-[#FF5500] animate-pulse'
                }`}
              />
              <span
                className={`font-label-caps text-[10px] uppercase tracking-wider font-extrabold group-hover:underline ${
                  athlete.status === 'UNKNOWN' ? 'text-[#737373]' : 'text-[#FF5500]'
                }`}
              >
                {athlete.statusText}
              </span>
            </div>
            <span className="font-telemetry text-xs text-[#F7F5F3] font-bold tracking-tight">
              {readiness.hrvPercentage}% HRV
            </span>
          </button>

          {/* Profile Trigger Button */}
          <button
            onClick={onOpenProfile}
            className="relative flex items-center justify-center p-0.5 rounded-full bg-[#1C1C1C] ring-2 ring-[#FF5500] shadow-[0_0_12px_rgba(255,85,0,0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Abrir perfil do atleta"
          >
            <Avatar
              name={athlete.name}
              src={athlete.avatarUrl}
              className="w-8 h-8 rounded-full object-cover"
              initialsClassName="text-[11px]"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-[#0D0D0D]"></span>
          </button>
        </div>
      </div>
    </header>
  );
};
