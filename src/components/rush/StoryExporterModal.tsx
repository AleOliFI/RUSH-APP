import React, { useState } from 'react';
import { APP_IMAGES } from '../../data/appAssets';
import { downloadImageToDevice } from '../../utils/imageDownload';

interface StoryExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoryExporterModal: React.FC<StoryExporterModalProps> = ({ isOpen, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<'video' | 'gif' | 'photo'>('gif');
  const [selectedPlatform, setSelectedPlatform] = useState<'stories' | 'tiktok' | 'whatsapp' | 'strava'>('stories');
  const [selectedStyle, setSelectedStyle] = useState<'tactical' | 'minimal' | 'map' | 'cardio'>('tactical');
  const [selectedColor, setSelectedColor] = useState<'#FF5500' | '#FFFFFF' | '#C3F400' | '#00E5FF'>('#FF5500');
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [animatedTelemetry, setAnimatedTelemetry] = useState(true);
  const [losslessCompression, setLosslessCompression] = useState(true);
  const [showBpm, setShowBpm] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [showShoe, setShowShoe] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      downloadImageToDevice(
        APP_IMAGES.marianaActionRunning,
        `rush_telemetry_story_${selectedFormat}_21k.jpg`,
        'Story de Telemetria Dinâmica RUSH'
      );
      setIsExporting(false);
      setExportFeedback('Exportado com sucesso para o dispositivo!');
      setTimeout(() => setExportFeedback(null), 3000);
    }, 1200);
  };

  const handleShareDirect = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Treino RUSH PRO • 21.10 KM',
          text: '21.10 km a 4:21/km com RUSH PRO Kinetic Telemetry.',
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      setExportFeedback('Link copiado para compartilhar nos Stories!');
      setTimeout(() => setExportFeedback(null), 3000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-exporter-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[95vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              EXPORTAR WORKOUT • TELEMETRIA DINÂMICA
            </span>
            <h2 id="story-exporter-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Canvas Stories & TikTok (9:16)
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar exportador"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 9:16 Interactive Canvas Container */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden border border-[#FF5500]/40 shadow-2xl bg-black select-none">
              {/* Background Photo */}
              <img
                src={APP_IMAGES.marianaActionRunning}
                alt="Atleta em Corrida"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

              {/* Safe-Zone Guide Overlay */}
              {showSafeZone && (
                <div className="absolute inset-0 border-x-2 border-y-8 border-[#FF5500]/30 pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex items-center justify-between text-[8px] font-telemetry text-[#FF5500] bg-black/60 px-1 py-0.5 rounded">
                    <span>TOP SAFE ZONE (STORIES)</span>
                    <span>1080x1920</span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-telemetry text-[#FF5500] bg-black/60 px-1 py-0.5 rounded">
                    <span>BOTTOM SAFE ZONE</span>
                    <span>60 FPS LOOP</span>
                  </div>
                </div>
              )}

              {/* Watermark Top */}
              <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedColor }} />
                <span className="font-headline text-[11px] text-white tracking-wider">RUSH PRO</span>
                <span className="font-telemetry text-[9px] text-[#A1A1AA]">TELEMETRY</span>
              </div>

              {/* Overlaid Kinetic HUD Sticker */}
              <div className="absolute inset-x-3 bottom-6 bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/20 shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]" style={{ color: selectedColor }}>
                      speed
                    </span>
                    <span className="font-headline text-sm text-white tracking-wide">
                      MEIA MARATONA • 21.10 KM
                    </span>
                  </div>
                  <span className="font-telemetry text-[10px] font-bold" style={{ color: selectedColor }}>
                    RP
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-white/5 p-1 rounded border border-white/10">
                    <span className="text-[8px] text-[#A1A1AA] uppercase block">TEMPO</span>
                    <span className="font-headline text-xs text-white">1:32:04</span>
                  </div>
                  <div className="bg-white/5 p-1 rounded border border-white/10">
                    <span className="text-[8px] text-[#A1A1AA] uppercase block">RITMO</span>
                    <span className="font-headline text-xs" style={{ color: selectedColor }}>
                      4:21/km
                    </span>
                  </div>
                  <div className="bg-white/5 p-1 rounded border border-white/10">
                    <span className="text-[8px] text-[#A1A1AA] uppercase block">BPM Z4</span>
                    <span className="font-headline text-xs text-white">166</span>
                  </div>
                </div>

                {showMap && (
                  <div className="flex items-center justify-between text-[9px] text-[#A1A1AA] pt-0.5 border-t border-white/10">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-[#22C55E]">alt_route</span>
                      USP Raia • +148m
                    </span>
                    {showShoe && (
                      <span className="truncate max-w-[120px]">Nike Vaporfly 3</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Safe Zone Toggle */}
          <div className="flex items-center justify-between bg-[#1C1C1C] p-3 rounded-xl border border-[#262626]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5500] text-[20px]">crop_free</span>
              <span className="text-xs font-bold text-[#F7F5F3]">Exibir Guias Safe-Zone 9:16</span>
            </div>
            <button
              onClick={() => setShowSafeZone(!showSafeZone)}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                showSafeZone ? 'bg-[#FF5500] text-[#0D0D0D]' : 'bg-[#262626] text-[#A1A1AA]'
              }`}
            >
              {showSafeZone ? 'Ativo' : 'Oculto'}
            </button>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Formato de Renderização
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gif', label: 'GIF Loop (60FPS)', icon: 'gif' },
                { id: 'video', label: 'Vídeo MP4', icon: 'movie' },
                { id: 'photo', label: 'Foto HD', icon: 'image' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id as any)}
                  className={`min-h-[44px] py-2 px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                    selectedFormat === fmt.id
                      ? 'bg-[#FF5500] text-[#0D0D0D] border-[#FF5500] font-extrabold shadow-md'
                      : 'bg-[#1C1C1C] text-[#A1A1AA] border-[#262626] hover:text-[#F7F5F3]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{fmt.icon}</span>
                  <span className="text-[10px] uppercase">{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Platform Presets */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Destino do Compartilhamento
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'stories', label: 'Stories' },
                { id: 'tiktok', label: 'TikTok' },
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'strava', label: 'Strava' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id as any)}
                  className={`min-h-[44px] py-2 px-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    selectedPlatform === p.id
                      ? 'bg-[#F7F5F3] text-[#0D0D0D]'
                      : 'bg-[#1C1C1C] text-[#A1A1AA] border border-[#262626] hover:text-[#F7F5F3]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Chips for Sticker HUD */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Paleta de Cor da Telemetria
            </span>
            <div className="flex items-center gap-3">
              {[
                { color: '#FF5500', name: 'Laranja Rush' },
                { color: '#FFFFFF', name: 'Branco Puro' },
                { color: '#C3F400', name: 'Volt Ácido' },
                { color: '#00E5FF', name: 'Ciano' },
              ].map((chip) => (
                <button
                  key={chip.color}
                  onClick={() => setSelectedColor(chip.color as any)}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                    selectedColor === chip.color
                      ? 'border-white bg-[#262626]'
                      : 'border-[#262626] bg-[#1C1C1C]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/40 shadow-inner"
                    style={{ backgroundColor: chip.color }}
                  />
                  <span className="text-xs text-[#F7F5F3] font-bold pr-1">{chip.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Metric Toggles */}
          <div className="bg-[#1C1C1C] p-3.5 rounded-xl border border-[#262626] space-y-2.5">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Elementos Sobrepostos
            </span>
            <div className="flex items-center justify-around text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBpm}
                  onChange={(e) => setShowBpm(e.target.checked)}
                  className="accent-[#FF5500] w-4 h-4 rounded"
                />
                <span className="text-[#F7F5F3]">Zonas BPM</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMap}
                  onChange={(e) => setShowMap(e.target.checked)}
                  className="accent-[#FF5500] w-4 h-4 rounded"
                />
                <span className="text-[#F7F5F3]">Traçado GPS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShoe}
                  onChange={(e) => setShowShoe(e.target.checked)}
                  className="accent-[#FF5500] w-4 h-4 rounded"
                />
                <span className="text-[#F7F5F3]">Tênis Pareado</span>
              </label>
            </div>
          </div>

          {/* Feedback banner */}
          {exportFeedback && (
            <div className="p-3 bg-[#22C55E]/15 border border-[#22C55E]/50 rounded-xl text-center text-[#22C55E] text-xs font-bold">
              {exportFeedback}
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-1">
            <button
              onClick={handleShareDirect}
              className="w-full min-h-[52px] py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF5500]/25 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">share</span>
              <span className="font-headline text-base uppercase tracking-wider whitespace-nowrap">
                Compartilhar no {selectedPlatform === 'stories' ? 'Instagram Stories' : selectedPlatform.toUpperCase()}
              </span>
            </button>

            <button
              onClick={handleDownloadExport}
              disabled={isExporting}
              className="w-full min-h-[48px] py-3 px-4 bg-[#262626] hover:bg-[#353534] active:scale-[0.98] text-[#F7F5F3] rounded-xl flex items-center justify-center gap-2 border border-[#353534] transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[20px] text-[#FF5500] ${isExporting ? 'animate-spin' : ''}`}>
                {isExporting ? 'progress_activity' : 'download'}
              </span>
              <span className="font-bold text-xs uppercase tracking-wider">
                {isExporting ? 'Renderizando Canvas...' : `Baixar ${selectedFormat.toUpperCase()} para o Aparelho`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
