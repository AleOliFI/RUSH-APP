import React, { useState } from 'react';
import { AthleteProfile, PhysiologicalReadiness } from '../types';

interface ProScreenProps {
  athlete: AthleteProfile;
  readiness: PhysiologicalReadiness;
  onOpenCheckout?: () => void;
  onOpenFieldProtocol?: () => void;
  onOpenBleHardware?: () => void;
  onOpenGearGarage?: () => void;
  onOpenStoryExporter?: () => void;
}

export const ProScreen: React.FC<ProScreenProps> = ({
  athlete,
  readiness,
  onOpenCheckout,
  onOpenFieldProtocol,
  onOpenBleHardware,
  onOpenGearGarage,
  onOpenStoryExporter,
}) => {
  const [synced, setSynced] = useState(false);
  const [activeDevice, setActiveDevice] = useState<string | null>('polar');

  const handleExport = (format: string) => {
    setSynced(true);
    setTimeout(() => setSynced(false), 3000);
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Pro Title Header */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-label-caps text-[10px] text-[#FACC15] uppercase tracking-widest font-extrabold block">
              DIAGNÓSTICO AVANÇADO
            </span>
            <span className="bg-[#FF5500] text-[#0D0D0D] font-telemetry text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
              PRO HUD
            </span>
          </div>
          <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
            TELEMETRIA CINÉTICA PRO
          </h1>
        </div>

        <button
          onClick={onOpenCheckout}
          className="px-3 py-1.5 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline text-xs uppercase tracking-wider font-extrabold flex items-center space-x-1.5 shadow-md shadow-[#FF5500]/25 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
          <span>UPGRADE PRO</span>
        </button>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onOpenFieldProtocol}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#FF5500] text-[22px]">biotech</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">
            Protocolo LTHR
          </span>
        </button>

        <button
          onClick={onOpenStoryExporter}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#22C55E] text-[22px]">auto_stories</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">
            Stories & TikTok 9:16
          </span>
        </button>

        <button
          onClick={onOpenGearGarage}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#FACC15] text-[22px]">sports_martial_arts</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">
            Garagem de Tênis
          </span>
        </button>

        <button
          onClick={onOpenBleHardware}
          className="min-h-[52px] p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all shadow"
        >
          <span className="material-symbols-outlined text-[#3B82F6] text-[22px]">bluetooth_connected</span>
          <span className="font-label-caps text-[9px] uppercase font-bold text-[#F7F5F3]">
            Sensores BLE
          </span>
        </button>
      </div>

      {/* Sync Toast if triggered */}
      {synced && (
        <div className="bg-[#22C55E]/15 border border-[#22C55E] text-[#22C55E] p-3 rounded-lg text-xs font-body font-bold flex items-center space-x-2 animate-bounce">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>Sincronização de telemetria (.FIT) concluída com sucesso!</span>
        </div>
      )}

      {/* 1. ACWR (Acute:Chronic Workload Ratio) Card */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="font-label-caps text-xs text-[#FF5500] uppercase font-extrabold tracking-wider">
            CARGA AGUDA VS. CRÔNICA (ACWR)
          </span>
          <span className="font-telemetry text-xs text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded font-bold border border-[#22C55E]/20">
            SWEET SPOT IDEAL (1.15)
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="font-metric-hero-mobile text-[#F7F5F3]">1.15</span>
            <span className="font-telemetry text-xs text-[#737373] ml-2">Ratio Ótimo (0.8 - 1.3)</span>
          </div>
          <div className="text-right font-telemetry text-xs text-[#737373]">
            Risco de Lesão: <span className="text-[#22C55E] font-bold">MUITO BAIXO</span>
          </div>
        </div>

        {/* ACWR Visual Range Bar */}
        <div className="w-full h-3 bg-[#101010] rounded-full overflow-hidden relative border border-[#202020] my-2">
          {/* Sweet spot highlight */}
          <div
            className="absolute top-0 bottom-0 bg-[#22C55E]/30"
            style={{ left: '35%', width: '35%' }}
          />
          {/* Indicator pin */}
          <div
            className="absolute top-0 bottom-0 w-2.5 bg-[#FF5500] rounded-full shadow-[0_0_8px_#FF5500]"
            style={{ left: '55%' }}
          />
        </div>
        <div className="flex justify-between font-label-sm text-[9px] text-[#737373]">
          <span>0.5 (Destreinamento)</span>
          <span className="text-[#22C55E] font-bold">0.8 - 1.3 (Zona Segura)</span>
          <span className="text-[#EF4444]">1.5+ (Sobrecarga)</span>
        </div>
      </div>

      {/* 2. Lactate Threshold & VO2 Max Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* VO2 Max */}
        <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626]">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="font-label-caps text-[10px] uppercase font-bold">VO2 MÁX ESTIMADO</span>
            <span className="material-symbols-outlined text-[16px] text-[#FF5500]">speed</span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="font-headline-lg-mobile text-[#F7F5F3]">{athlete.vo2Max}</span>
            <span className="font-label-sm text-[10px] text-[#737373] font-bold">mL/kg/min</span>
          </div>
          <span className="font-label-sm text-[10px] text-[#22C55E] font-bold block mt-1">
            Top 1.5% da Faixa Etária
          </span>
        </div>

        {/* Limiar de Lactato Pace */}
        <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626]">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="font-label-caps text-[10px] uppercase font-bold">LIMIAR ANAERÓBICO</span>
            <span className="material-symbols-outlined text-[16px] text-[#FF5500]">timeline</span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="font-headline-lg-mobile text-[#FF5500]">{athlete.thresholdPace}</span>
          </div>
          <span className="font-label-sm text-[10px] text-[#737373] block mt-1">
            OBLA: 4.0 mmol/L em 176 bpm
          </span>
        </div>
      </div>

      {/* 3. Curva de Lactato Sanguíneo (SVG Chart) */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-xs text-[#F7F5F3] uppercase font-bold tracking-wider">
            CURVA DINÂMICA DE LACTATO
          </span>
          <span className="font-telemetry text-xs text-[#FF5500]">Pace vs. mmol/L</span>
        </div>

        {/* Tactical Chart Graphic */}
        <div className="h-44 w-full bg-[#101010] rounded-lg p-3 relative border border-[#202020] flex flex-col justify-end">
          <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="30" x2="300" y2="30" stroke="#222" strokeDasharray="3,3" />
            <line x1="0" y1="60" x2="300" y2="60" stroke="#222" strokeDasharray="3,3" />
            <line x1="0" y1="90" x2="300" y2="90" stroke="#222" strokeDasharray="3,3" />

            {/* Threshold Line (4 mmol/L) */}
            <line x1="0" y1="50" x2="300" y2="50" stroke="#EF4444" strokeWidth="1" strokeDasharray="4,4" />
            <text x="210" y="46" fill="#EF4444" fontSize="8" fontFamily="JetBrains Mono">
              LIMIAR (4.0 mmol)
            </text>

            {/* Lactate curve spline */}
            <path
              d="M 10 110 Q 90 105, 160 90 T 230 50 T 290 15"
              fill="none"
              stroke="#FF5500"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Current threshold point */}
            <circle cx="230" cy="50" r="5" fill="#FF5500" stroke="#0D0D0D" strokeWidth="2" />
          </svg>

          <div className="flex justify-between text-[10px] font-telemetry text-[#737373] mt-1">
            <span>5:30/km (Z1)</span>
            <span>4:40/km (Z2)</span>
            <span className="text-[#FF5500] font-bold">3:45/km (Z4 Limiar)</span>
            <span>3:15/km (Z5)</span>
          </div>
        </div>
      </div>

      {/* 4. BLE Hardware & Sensor Hub */}
      <div className="rounded-xl bg-[#1C1C1C] p-5 border border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-xs text-[#F7F5F3] uppercase font-extrabold tracking-wider">
            HUB DE SENSORES PERIFÉRICOS (BLE)
          </span>
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
        </div>

        <div className="space-y-2">
          {/* Device 1 */}
          <div
            onClick={() => setActiveDevice('polar')}
            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
              activeDevice === 'polar'
                ? 'bg-[#201f1f] border-[#FF5500]'
                : 'bg-[#101010] border-[#202020]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="material-symbols-outlined text-[#FF5500] text-[20px]">monitor_heart</span>
              <div>
                <span className="font-body text-xs font-bold text-[#F7F5F3] block">POLAR H10 ECG STRAP</span>
                <span className="font-telemetry text-[10px] text-[#737373]">Bateria 92% • Conexão Ativa</span>
              </div>
            </div>
            <span className="font-label-sm text-[10px] text-[#22C55E] font-bold">CONECTADO</span>
          </div>

          {/* Device 2 */}
          <div
            onClick={() => setActiveDevice('stryd')}
            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
              activeDevice === 'stryd'
                ? 'bg-[#201f1f] border-[#FF5500]'
                : 'bg-[#101010] border-[#202020]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="material-symbols-outlined text-[#737373] text-[20px]">directions_run</span>
              <div>
                <span className="font-body text-xs font-bold text-[#F7F5F3] block">STRYD NEXT GEN (FOOTPOD)</span>
                <span className="font-telemetry text-[10px] text-[#737373]">Potência Crítica & Cadência</span>
              </div>
            </div>
            <span className="font-label-sm text-[10px] text-[#737373]">EM ESPERA</span>
          </div>
        </div>
      </div>

      {/* 5. Export Telemetry */}
      <div className="rounded-xl bg-[#141414] p-4 border border-[#262626] space-y-3">
        <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold tracking-wider block">
          EXPORTAÇÃO & INTEGRAÇÕES
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleExport('FIT')}
            className="h-11 rounded bg-[#1C1C1C] hover:bg-[#FF5500] hover:text-[#0D0D0D] text-[#F7F5F3] text-xs font-telemetry font-bold border border-[#262626] transition-colors cursor-pointer"
          >
            .FIT DATA
          </button>
          <button
            onClick={() => handleExport('GPX')}
            className="h-11 rounded bg-[#1C1C1C] hover:bg-[#FF5500] hover:text-[#0D0D0D] text-[#F7F5F3] text-xs font-telemetry font-bold border border-[#262626] transition-colors cursor-pointer"
          >
            .GPX TRACK
          </button>
          <button
            onClick={() => handleExport('STRAVA')}
            className="h-11 rounded bg-[#1C1C1C] hover:bg-[#FF5500] hover:text-[#0D0D0D] text-[#F7F5F3] text-xs font-telemetry font-bold border border-[#262626] transition-colors cursor-pointer"
          >
            STRAVA SYNC
          </button>
        </div>
      </div>
    </div>
  );
};
