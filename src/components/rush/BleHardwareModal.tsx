import React, { useState, useEffect } from 'react';

interface BleHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BleHardwareModal: React.FC<BleHardwareModalProps> = ({ isOpen, onClose }) => {
  const [liveBpm, setLiveBpm] = useState(66);
  const [prioritizeStrap, setPrioritizeStrap] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [audioAlertDrop, setAudioAlertDrop] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('ESCANEAR NOVOS DISPOSITIVOS');
  const [calibrating, setCalibrating] = useState(false);
  const [syncingGarmin, setSyncingGarmin] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<{ [key: string]: boolean }>({
    stryd: false,
    wahoo: false,
    coros: false,
  });

  // Micro-fluctuation of live heart rate
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setLiveBpm((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(62, Math.min(70, prev + delta));
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualScan = () => {
    setIsScanning(true);
    setScanMessage('BUSCANDO SINAIS PRÓXIMOS (2.4 GHz)...');
    setTimeout(() => {
      setIsScanning(false);
      setScanMessage('ESCANEAMENTO CONCLUÍDO • 3 ENCONTRADOS');
      setTimeout(() => {
        setScanMessage('ESCANEAR NOVOS DISPOSITIVOS');
      }, 2500);
    }, 1800);
  };

  const handleCalibrateEcg = () => {
    setCalibrating(true);
    setTimeout(() => {
      setCalibrating(false);
    }, 1500);
  };

  const handleSyncGarmin = () => {
    setSyncingGarmin(true);
    setTimeout(() => {
      setSyncingGarmin(false);
    }, 1200);
  };

  const toggleConnect = (key: string) => {
    setConnectedDevices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ble-modal-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/85 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[92vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/50 shadow-[0_-12px_40px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              HARDWARE & PROTOCOLS
            </span>
            <h2 id="ble-modal-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Sensores & BLE 5.3
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#1C1C1C] px-3 py-1 rounded-full border border-[#262626]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5500] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5500]" />
              </span>
              <span className="font-label-sm text-[10px] text-[#F7F5F3] uppercase font-bold tracking-wider">
                BLE / ANT+ ATIVO
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fechar modal de hardware"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Real-time active connection HUD */}
          <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626] shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[11px] text-[#A1A1AA] uppercase tracking-wider">
                Conexões Ativas em Tempo Real
              </span>
              <span className="font-telemetry text-[#FF5500] text-xs font-bold">LATÊNCIA: 12ms</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#101010] p-3 rounded-lg flex items-center justify-between border border-[#262626]">
                <div className="min-w-0">
                  <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block leading-tight">
                    CINTA PEITORAL
                  </span>
                  <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide truncate block">
                    POLAR H10
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#FF5500] text-[24px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                  ecg_heart
                </span>
              </div>
              <div className="bg-[#101010] p-3 rounded-lg flex items-center justify-between border border-[#262626]">
                <div className="min-w-0">
                  <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block leading-tight">
                    SMARTWATCH
                  </span>
                  <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide truncate block">
                    FORERUNNER
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#FF5500] text-[24px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                  watch
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Dispositivos Pareados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#22C55E] text-[18px]">check_circle</span>
                <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                  Dispositivos Pareados (2)
                </h3>
              </div>
              <span className="font-telemetry text-[11px] text-[#A1A1AA] uppercase font-bold">TAXA 1000HZ</span>
            </div>

            {/* Card 1: Polar H10 */}
            <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626] shadow-lg relative overflow-hidden space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-[#101010] flex items-center justify-center text-[#FF5500] border border-[#262626] shadow-inner shrink-0">
                    <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      cardiology
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline text-lg text-[#F7F5F3] tracking-wide">Polar H10 ECG</span>
                      <span className="bg-[#FF5500]/15 text-[#FF5500] font-label-sm text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">
                        Master HR
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 flex-wrap font-telemetry text-xs">
                      <span className="inline-flex items-center gap-1 text-[#22C55E] font-bold">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Conectado (1000Hz)
                      </span>
                      <span className="text-[#A1A1AA] flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[15px] text-[#22C55E]">battery_charging_full</span> 98%
                      </span>
                      <span className="text-[#A1A1AA] bg-[#101010] px-1.5 py-0.5 rounded border border-[#262626]">
                        ID: #H10-8482
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Heart Rate & ECG waveform */}
              <div className="bg-[#101010] p-3 rounded-lg border border-[#262626] flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="font-headline text-4xl text-[#FF5500] leading-none tracking-tight">
                    {liveBpm}
                  </span>
                  <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-wider">
                    BPM AO VIVO
                  </span>
                </div>
                <div className="flex-1 max-w-[130px] h-8 px-1 flex items-center justify-center min-w-[70px]">
                  <svg className="w-full h-full text-[#FF5500] overflow-visible" fill="none" viewBox="0 0 160 36">
                    <path
                      className="opacity-90"
                      d="M0 18 L40 18 L48 18 L53 6 L59 30 L65 2 L71 24 L76 18 L85 18 L93 18 L98 8 L104 28 L110 4 L116 23 L121 18 L160 18"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-label-sm text-[10px] text-[#22C55E] block font-bold leading-tight">
                    ECG 1.000Hz
                  </span>
                  <span className="font-telemetry text-[11px] text-[#A1A1AA] font-bold">VFC: 88ms</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <button
                  onClick={handleCalibrateEcg}
                  className="min-h-[44px] bg-[#262626] hover:bg-[#353534] active:scale-95 text-[#F7F5F3] font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-[#353534] transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[18px] text-[#FF5500] ${calibrating ? 'animate-spin' : ''}`}>
                    tune
                  </span>
                  <span>{calibrating ? 'Calibrando (0.2ms)...' : 'Calibrar ECG'}</span>
                </button>
                <button
                  onClick={() => alert('Sensor Polar H10 mantido na malha prioritária.')}
                  className="min-h-[44px] bg-[#262626] hover:bg-[#353534] hover:text-[#EF4444] active:scale-95 text-[#A1A1AA] font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-[#353534] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">link_off</span>
                  <span>Desconectar</span>
                </button>
              </div>
            </div>

            {/* Card 2: Garmin Forerunner 965 */}
            <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626] shadow-lg relative space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-[#101010] flex items-center justify-center text-[#F7F5F3] border border-[#262626] shadow-inner shrink-0">
                    <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      watch
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-headline text-lg text-[#F7F5F3] tracking-wide truncate">
                        Garmin Forerunner 965
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 flex-wrap font-telemetry text-xs">
                      <span className="inline-flex items-center gap-1 text-[#22C55E] font-bold">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Sincronizado
                      </span>
                      <span className="text-[#A1A1AA] flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[15px] text-[#A1A1AA]">battery_5_bar</span> 84%
                      </span>
                      <span className="text-[#A1A1AA] bg-[#101010] px-1.5 py-0.5 rounded border border-[#262626]">
                        ANT+ & BLE
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="font-label-sm text-[9px] text-[#A1A1AA] uppercase block leading-tight">
                    GPS MULTIBANDA
                  </span>
                  <span className="font-telemetry text-xs text-[#22C55E] font-bold block mt-0.5">L1+L5 FIX</span>
                </div>
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="font-label-sm text-[9px] text-[#A1A1AA] uppercase block leading-tight">
                    CADÊNCIA
                  </span>
                  <span className="font-telemetry text-xs text-[#F7F5F3] font-bold block mt-0.5">182 SPM</span>
                </div>
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="font-label-sm text-[9px] text-[#A1A1AA] uppercase block leading-tight">
                    TEMPO CONTATO
                  </span>
                  <span className="font-telemetry text-xs text-[#F7F5F3] font-bold block mt-0.5">214 ms</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <button
                  onClick={handleSyncGarmin}
                  className="min-h-[44px] bg-[#262626] hover:bg-[#353534] active:scale-95 text-[#F7F5F3] font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-[#353534] transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[18px] text-[#FF5500] ${syncingGarmin ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span>{syncingGarmin ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>
                <button
                  onClick={() => alert('Garmin Forerunner 965 mantido pareado.')}
                  className="min-h-[44px] bg-[#262626] hover:bg-[#353534] hover:text-[#EF4444] active:scale-95 text-[#A1A1AA] font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-[#353534] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">link_off</span>
                  <span>Desconectar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Dispositivos Disponíveis (Radar BLE) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5500] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5500]" />
                </span>
                <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                  Disponíveis para Parear
                </h3>
              </div>
              <span className="font-label-sm text-[10px] text-[#FF5500] uppercase font-bold tracking-wider">
                Escaneando 2.4 GHz...
              </span>
            </div>

            {/* Stryd */}
            <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#101010] flex items-center justify-center text-[#FF5500] shrink-0 border border-[#262626]">
                  <span className="material-symbols-outlined text-[22px]">sprint</span>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#F7F5F3] truncate">Stryd NextGen Footpod</span>
                    <span className="bg-[#c3f400] text-[#0D0D0D] font-telemetry text-[9px] font-extrabold px-1 rounded uppercase">
                      WATTS
                    </span>
                  </div>
                  <p className="font-telemetry text-xs text-[#A1A1AA] truncate mt-0.5">Potência & Vento (-48 dBm)</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="font-label-sm text-[10px] text-[#22C55E] ml-1 font-bold">Sinal Forte</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleConnect('stryd')}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg shrink-0 uppercase tracking-wider font-extrabold text-xs shadow-md transition-all cursor-pointer ${
                  connectedDevices.stryd
                    ? 'bg-[#22C55E] text-[#0D0D0D]'
                    : 'bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D]'
                }`}
              >
                {connectedDevices.stryd ? '✓ Pareado' : 'Conectar'}
              </button>
            </div>

            {/* Wahoo TICKR X */}
            <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#101010] flex items-center justify-center text-[#F7F5F3] shrink-0 border border-[#262626]">
                  <span className="material-symbols-outlined text-[22px]">monitor_heart</span>
                </div>
                <div className="truncate">
                  <span className="font-bold text-sm text-[#F7F5F3] truncate block">Wahoo TICKR X</span>
                  <p className="font-telemetry text-xs text-[#A1A1AA] truncate mt-0.5">Cinta Peitoral Óptica (-65 dBm)</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#353534] rounded-xs inline-block" />
                    <span className="font-label-sm text-[10px] text-[#A1A1AA] ml-1 font-bold">Sinal Bom</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleConnect('wahoo')}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg shrink-0 uppercase tracking-wider font-bold text-xs border border-[#353534] shadow transition-all cursor-pointer ${
                  connectedDevices.wahoo
                    ? 'bg-[#22C55E] text-[#0D0D0D]'
                    : 'bg-[#262626] hover:bg-[#353534] text-[#F7F5F3]'
                }`}
              >
                {connectedDevices.wahoo ? '✓ Pareado' : 'Conectar'}
              </button>
            </div>

            {/* Coros Pace 3 */}
            <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#101010] flex items-center justify-center text-[#A1A1AA] shrink-0 border border-[#262626]">
                  <span className="material-symbols-outlined text-[22px]">device_hub</span>
                </div>
                <div className="truncate">
                  <span className="font-bold text-sm text-[#F7F5F3] truncate block">COROS Pace 3</span>
                  <p className="font-telemetry text-xs text-[#A1A1AA] truncate mt-0.5">Relógio GPS & Sensor (-72 dBm)</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#FF5500] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#353534] rounded-xs inline-block" />
                    <span className="w-1.5 h-2.5 bg-[#353534] rounded-xs inline-block" />
                    <span className="font-label-sm text-[10px] text-[#A1A1AA] ml-1 font-bold">Estável</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleConnect('coros')}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg shrink-0 uppercase tracking-wider font-bold text-xs border border-[#353534] shadow transition-all cursor-pointer ${
                  connectedDevices.coros
                    ? 'bg-[#22C55E] text-[#0D0D0D]'
                    : 'bg-[#262626] hover:bg-[#353534] text-[#F7F5F3]'
                }`}
              >
                {connectedDevices.coros ? '✓ Pareado' : 'Conectar'}
              </button>
            </div>
          </div>

          {/* Section 3: Roteamento de Sinal */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#FF5500] text-[20px]">settings_input_antenna</span>
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                Roteamento de Sinal
              </h3>
            </div>

            <div className="bg-[#1C1C1C] p-4 rounded-xl border border-[#262626] shadow-md space-y-4">
              {/* Toggle 1 */}
              <div className="flex items-center justify-between gap-3 min-h-[44px]">
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-sm text-[#F7F5F3] block">Priorizar Cinta Peitoral</span>
                  <span className="text-xs text-[#A1A1AA] block leading-relaxed">
                    Substitui o leitor óptico de pulso para garantir precisão ECG em milissegundos.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prioritizeStrap}
                  onClick={() => setPrioritizeStrap(!prioritizeStrap)}
                  className="min-w-[48px] min-h-[44px] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <span className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center ${prioritizeStrap ? 'bg-[#FF5500]' : 'bg-[#262626] border border-[#353534]'}`}>
                    <span className={`inline-block w-5 h-5 rounded-full shadow-md transform transition duration-200 ${prioritizeStrap ? 'translate-x-6 bg-[#0D0D0D]' : 'translate-x-0.5 bg-[#A1A1AA]'}`} />
                  </span>
                </button>
              </div>

              <div className="border-t border-[#262626]" />

              {/* Toggle 2 */}
              <div className="flex items-center justify-between gap-3 min-h-[44px]">
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-sm text-[#F7F5F3] block">Auto-reconexão no Tiro</span>
                  <span className="text-xs text-[#A1A1AA] block leading-relaxed">
                    Recupera link BLE instantaneamente sem pausar a sessão de treino.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoReconnect}
                  onClick={() => setAutoReconnect(!autoReconnect)}
                  className="min-w-[48px] min-h-[44px] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <span className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center ${autoReconnect ? 'bg-[#FF5500]' : 'bg-[#262626] border border-[#353534]'}`}>
                    <span className={`inline-block w-5 h-5 rounded-full shadow-md transform transition duration-200 ${autoReconnect ? 'translate-x-6 bg-[#0D0D0D]' : 'translate-x-0.5 bg-[#A1A1AA]'}`} />
                  </span>
                </button>
              </div>

              <div className="border-t border-[#262626]" />

              {/* Toggle 3 */}
              <div className="flex items-center justify-between gap-3 min-h-[44px]">
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-sm text-[#F7F5F3] block">Alerta Sonoro de Queda</span>
                  <span className="text-xs text-[#A1A1AA] block leading-relaxed">
                    Vibração e bipe tático caso o sensor cardíaco se desconecte em atividade.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={audioAlertDrop}
                  onClick={() => setAudioAlertDrop(!audioAlertDrop)}
                  className="min-w-[48px] min-h-[44px] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <span className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center ${audioAlertDrop ? 'bg-[#FF5500]' : 'bg-[#262626] border border-[#353534]'}`}>
                    <span className={`inline-block w-5 h-5 rounded-full shadow-md transform transition duration-200 ${audioAlertDrop ? 'translate-x-6 bg-[#0D0D0D]' : 'translate-x-0.5 bg-[#A1A1AA]'}`} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Trigger Scan CTA */}
          <div className="pt-2">
            <button
              onClick={handleManualScan}
              className="w-full min-h-[52px] py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF5500]/25 transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[24px] ${isScanning ? 'animate-spin' : ''}`}>
                radar
              </span>
              <span className="font-headline text-base uppercase tracking-wider whitespace-nowrap leading-none">
                {scanMessage}
              </span>
            </button>
          </div>

          {/* Protocol Precision Footnote */}
          <div className="bg-[#101010] p-4 rounded-xl space-y-1.5 border border-[#262626] shadow-inner mb-4">
            <div className="flex items-center gap-2 text-[#FF5500]">
              <span className="material-symbols-outlined text-[18px]">science</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider font-bold">
                Protocolo de Precisão RUSH
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Recomendação: Cintas peitorais com eletrodos galvânicos de ECG (Polar H10 / Garmin HRM-Pro) capturam o intervalo R-R em alta frequência, eliminando ruído óptico para cálculo fidedigno da sua VFC matinal e limiares de lactato.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
