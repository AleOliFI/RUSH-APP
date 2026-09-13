import React, { useState } from 'react';
import { AthleteProfile, ImageViewerItem } from '../../types';
import { ATHLETES } from '../../data/appAssets';
import { downloadImageToDevice } from '../../utils/imageDownload';

interface AthleteModalProps {
  currentAthlete: AthleteProfile;
  isOpen: boolean;
  onClose: () => void;
  onSelectAthlete: (athlete: AthleteProfile) => void;
  onViewImage?: (item: ImageViewerItem) => void;
}

export const AthleteModal: React.FC<AthleteModalProps> = ({
  currentAthlete,
  isOpen,
  onClose,
  onSelectAthlete,
  onViewImage,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadPhoto = async (e: React.MouseEvent, athlete: AthleteProfile) => {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(athlete.id);
    const filename = `rush-running-atleta-${athlete.name.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`;
    await downloadImageToDevice(athlete.avatarUrl, filename);
    setDownloadingId(null);
  };

  const handleViewPhoto = (e: React.MouseEvent, athlete: AthleteProfile) => {
    e.stopPropagation();
    if (onViewImage) {
      onViewImage({
        url: athlete.avatarUrl,
        title: `${athlete.name} (${athlete.category})`,
        subtitle: athlete.quote,
        category: 'PASSAPORTE BIOMÉTRICO DO ATLETA',
        filename: `rush-running-atleta-${athlete.name.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`,
        description: `Foto de passaporte atlético oficial de ${athlete.name}. VO2 Máx: ${athlete.vo2Max} mL/kg/min, Frequência de Repouso: ${athlete.restingHR} BPM, Limiar: ${athlete.thresholdPace}.`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1C1C1C] border border-[#262626] w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[#FF5500] text-[22px]">badge</span>
            <div>
              <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
                PERFIL DO ATLETA
              </span>
              <h2 className="font-headline-sm text-[#F7F5F3] uppercase">
                PASSAPORTE BIOMÉTRICO
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#101010] text-[#737373] hover:text-[#FF5500] flex items-center justify-center cursor-pointer border border-[#262626]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Current Active Athlete Showcase */}
        <div className="bg-[#101010] p-4 rounded-xl border border-[#FF5500]/40 flex flex-col space-y-3">
          <div className="flex items-center space-x-4">
            <div 
              className="relative flex-shrink-0 cursor-pointer group"
              onClick={(e) => handleViewPhoto(e, currentAthlete)}
              title="Clique para visualizar em alta resolução"
            >
              <img
                alt={currentAthlete.name}
                className="w-16 h-16 rounded-xl object-cover ring-2 ring-[#FF5500] shadow-[0_0_12px_rgba(255,85,0,0.4)] group-hover:brightness-110 transition-all"
                src={currentAthlete.avatarUrl}
              />
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="material-symbols-outlined text-white text-[20px]">zoom_in</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#22C55E] ring-2 ring-[#101010]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-headline-sm text-[#F7F5F3] truncate">{currentAthlete.name}</span>
                <span className="px-1.5 py-0.2 bg-[#FF5500] text-[#0D0D0D] font-telemetry text-[10px] rounded uppercase font-extrabold">
                  {currentAthlete.category}
                </span>
              </div>
              <p className="font-body text-xs text-[#737373] mt-0.5">{currentAthlete.quote}</p>
              <span className="font-telemetry text-[11px] text-[#22C55E] font-bold mt-1 inline-block">
                {currentAthlete.statusText}
              </span>
            </div>
          </div>

          {/* Action buttons for Active Athlete's Photo */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#202020]">
            <button
              onClick={(e) => handleViewPhoto(e, currentAthlete)}
              className="flex-1 h-8 rounded bg-[#1C1C1C] hover:bg-[#262626] border border-[#333] text-[#F7F5F3] text-[11px] font-label-caps uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-[#FF5500]">visibility</span>
              <span>Visualizar Foto</span>
            </button>
            <button
              onClick={(e) => handleDownloadPhoto(e, currentAthlete)}
              disabled={downloadingId === currentAthlete.id}
              className="flex-1 h-8 rounded bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] text-[11px] font-label-caps font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Salvar foto deste atleta no seu dispositivo"
            >
              <span className="material-symbols-outlined text-[15px]">
                {downloadingId === currentAthlete.id ? 'progress_activity' : 'download'}
              </span>
              <span>
                {downloadingId === currentAthlete.id ? 'Baixando...' : 'Baixar Foto'}
              </span>
            </button>
          </div>
        </div>

        {/* Athlete Biometric Baseline Grid */}
        <div className="grid grid-cols-3 gap-2 bg-[#141414] p-3 rounded-lg border border-[#262626] text-center">
          <div>
            <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">VO2 MÁX</span>
            <div className="font-headline-sm text-[#F7F5F3] mt-0.5">{currentAthlete.vo2Max}</div>
            <span className="font-label-sm text-[9px] text-[#737373]">mL/kg/min</span>
          </div>
          <div>
            <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">RHR REPOUSO</span>
            <div className="font-headline-sm text-[#FF5500] mt-0.5">{currentAthlete.restingHR}</div>
            <span className="font-label-sm text-[9px] text-[#737373]">BPM</span>
          </div>
          <div>
            <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">LIMIAR PACE</span>
            <div className="font-headline-sm text-[#22C55E] mt-0.5">{currentAthlete.thresholdPace}</div>
            <span className="font-label-sm text-[9px] text-[#737373]">min/km</span>
          </div>
        </div>

        {/* Switch Athlete Profile */}
        <div className="space-y-2 pt-1">
          <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold tracking-wider block">
            SELECIONAR CONTA / ATLETA ATIVO
          </span>
          <div className="space-y-2">
            {ATHLETES.map((ath) => {
              const isSelected = ath.id === currentAthlete.id;
              return (
                <div
                  key={ath.id}
                  className={`w-full p-3 rounded-lg border flex items-center justify-between transition-all text-left ${
                    isSelected
                      ? 'bg-[#201f1f] border-[#FF5500]'
                      : 'bg-[#101010] border-[#262626] hover:border-[#444]'
                  }`}
                >
                  <button
                    onClick={() => onSelectAthlete(ath)}
                    className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer text-left"
                  >
                    <div 
                      className="relative"
                      onClick={(e) => handleViewPhoto(e, ath)}
                      title="Visualizar foto"
                    >
                      <img
                        alt={ath.name}
                        className="w-10 h-10 rounded-lg object-cover hover:ring-1 hover:ring-[#FF5500]"
                        src={ath.avatarUrl}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-body text-xs font-bold text-[#F7F5F3]">{ath.name}</span>
                        <span className="text-[9px] bg-[#FF5500]/15 text-[#FF5500] px-1 py-0.2 rounded font-telemetry font-extrabold">
                          {ath.category}
                        </span>
                      </div>
                      <span className="font-telemetry text-[10px] text-[#737373]">
                        VO2: {ath.vo2Max} • RHR: {ath.restingHR} BPM
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center space-x-2 ml-2">
                    {/* Direct Download Icon */}
                    <button
                      onClick={(e) => handleDownloadPhoto(e, ath)}
                      title={`Baixar foto de ${ath.name}`}
                      className="w-8 h-8 rounded bg-[#1C1C1C] hover:bg-[#FF5500] hover:text-[#0D0D0D] text-[#737373] border border-[#333] flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                    </button>

                    {isSelected && (
                      <span className="material-symbols-outlined text-[#FF5500] text-[20px]">
                        check_circle
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full h-12 bg-[#262626] hover:bg-[#333] text-[#F7F5F3] font-headline-sm text-xs uppercase rounded-lg transition-colors cursor-pointer"
        >
          CONFIRMAR & FECHAR
        </button>
      </div>
    </div>
  );
};
