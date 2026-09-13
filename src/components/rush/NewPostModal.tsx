import React, { useState } from 'react';
import { APP_IMAGES } from '../../data/appAssets';

interface NewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (caption: string) => void;
}

export const NewPostModal: React.FC<NewPostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const [caption, setCaption] = useState(
    'Meia-maratona de hoje fechada no asfalto! Sensação de ritmo constante em Z4 e cadência média de 182 spm. Sub-1h35 garantido com o novo plano RUSH PRO! 🏃‍♀️🔥'
  );
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [showMap, setShowMap] = useState(true);
  const [showHudSticker, setShowHudSticker] = useState(true);
  const [syncStrava, setSyncStrava] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPostCreated(caption);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-post-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[94vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              COMUNIDADE & FEED
            </span>
            <h2 id="new-post-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Novo Post de Treino
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar novo post"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Author Header & Privacy selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={APP_IMAGES.headerAvatar}
                alt="Mariana Vasconcelos"
                className="w-10 h-10 rounded-full object-cover border border-[#353534]"
              />
              <div>
                <span className="font-bold text-sm text-[#F7F5F3] block">Mariana Vasconcelos</span>
                <span className="text-xs text-[#A1A1AA]">@marianarun • Atleta PRO</span>
              </div>
            </div>

            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as any)}
              className="bg-[#1C1C1C] border border-[#262626] text-[#F7F5F3] text-xs py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-[#FF5500] cursor-pointer"
            >
              <option value="public">🌐 Público (Todos)</option>
              <option value="followers">👥 Pelotão (Seguidores)</option>
              <option value="private">🔒 Apenas Eu</option>
            </select>
          </div>

          {/* Textarea with live character counter */}
          <div className="space-y-1">
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Compartilhe percepção de esforço, ritmo, nutrição ou estratégia de prova..."
              className="w-full bg-[#1C1C1C] border border-[#262626] rounded-2xl p-3.5 text-xs text-[#F7F5F3] placeholder-[#737373] focus:outline-none focus:border-[#FF5500] resize-none leading-relaxed"
            />
            <div className="flex justify-end text-[11px] font-telemetry text-[#737373]">
              {caption.length} / 500 caracteres
            </div>
          </div>

          {/* Attached Treino Card */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Treino Sincronizado Anexo
            </span>

            <div className="bg-[#1C1C1C] p-3.5 rounded-2xl border border-[#22C55E]/40 shadow-md space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#22C55E] text-[20px]">verified</span>
                  <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide">
                    Meia Maratona 21.10 KM (RP)
                  </span>
                </div>
                <span className="font-telemetry text-xs text-[#22C55E] font-bold">1:32:04</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs font-telemetry">
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="text-[9px] text-[#A1A1AA] uppercase block">KM</span>
                  <span className="font-bold text-[#F7F5F3] block mt-0.5">21.1</span>
                </div>
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="text-[9px] text-[#A1A1AA] uppercase block">RITMO</span>
                  <span className="font-bold text-[#FF5500] block mt-0.5">4:21/km</span>
                </div>
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="text-[9px] text-[#A1A1AA] uppercase block">BPM</span>
                  <span className="font-bold text-[#EF4444] block mt-0.5">166</span>
                </div>
                <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                  <span className="text-[9px] text-[#A1A1AA] uppercase block">SPM</span>
                  <span className="font-bold text-[#22C55E] block mt-0.5">182</span>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Preview Attachment with overlaid sticker */}
          <div className="relative h-44 rounded-2xl overflow-hidden border border-[#262626] bg-[#101010]">
            <img
              src={APP_IMAGES.marcosSilvaActivity}
              alt="Foto do Treino"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {showHudSticker && (
              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
                <span className="font-headline text-white">RUSH HUD • 21.1 KM</span>
                <span className="font-telemetry text-[#FF5500] font-bold">4:21/km</span>
              </div>
            )}

            <span className="absolute top-3 right-3 bg-black/70 text-white text-[10px] font-telemetry px-2 py-0.5 rounded border border-white/20">
              1 FOTO ANEXA
            </span>
          </div>

          {/* Toggles */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3 text-xs">
            <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
              <span className="text-[#F7F5F3] font-bold">Exibir mapa de altimetria e traçado GPS</span>
              <input
                type="checkbox"
                checked={showMap}
                onChange={(e) => setShowMap(e.target.checked)}
                className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer"
              />
            </label>
            <div className="border-t border-[#262626]" />
            <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
              <span className="text-[#F7F5F3] font-bold">Sobrepor Sticker Oficial RUSH HUD na imagem</span>
              <input
                type="checkbox"
                checked={showHudSticker}
                onChange={(e) => setShowHudSticker(e.target.checked)}
                className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer"
              />
            </label>
            <div className="border-t border-[#262626]" />
            <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-2">
                <span className="text-[#F7F5F3] font-bold">Sincronizar publicação com Strava</span>
                <span className="text-[10px] bg-[#FC4C02] text-white px-1.5 py-0.2 rounded font-black">
                  STRAVA
                </span>
              </div>
              <input
                type="checkbox"
                checked={syncStrava}
                onChange={(e) => setSyncStrava(e.target.checked)}
                className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full min-h-[54px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#FF5500]/30 font-headline text-lg uppercase tracking-wider transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">send</span>
              <span>Publicar no Feed da Comunidade</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
