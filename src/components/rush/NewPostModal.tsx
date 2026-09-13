// ============================================================
// RUSH RUNNING — Nova publicação no feed
// ------------------------------------------------------------
// No modelo do backend a postagem É a atividade: publicar grava a
// legenda, a foto e a privacidade escolhidas na corrida selecionada.
// Sem nenhuma atividade registrada não há o que publicar, e a tela
// diz isso em vez de fingir que postou.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AthleteProfile } from '../../types';
import { activities as activitiesApi } from '../../api';
import { formatDuration, paceFromActivity, timeAgo } from '../../data/adapters';
import { prepareImageForUpload } from '../../utils/imageUpload';

interface NewPostModalProps {
  isOpen: boolean;
  athlete: AthleteProfile;
  onClose: () => void;
  onPosted: () => void;
}

interface SelectableActivity {
  id: string;
  title: string;
  date: string;
  distanceKm: number;
  durationSeconds: number;
  avgPace: string;
  avgHr: number | null;
  imageUrl: string | null;
  description: string | null;
  privacy: 'public' | 'followers' | 'private';
}

const MAX_CAPTION = 500;

export const NewPostModal: React.FC<NewPostModalProps> = ({ isOpen, athlete, onClose, onPosted }) => {
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [showHudSticker, setShowHudSticker] = useState(true);
  const [recent, setRecent] = useState<SelectableActivity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await activitiesApi.list(1);
      const mapped: SelectableActivity[] = (data.activities || []).slice(0, 8).map((a: any) => ({
        id: a.id,
        title: a.title || 'Atividade',
        date: a.date,
        distanceKm: a.distance_km || 0,
        durationSeconds: a.duration_seconds || 0,
        avgPace: a.avg_pace || `${paceFromActivity(a.distance_km || 0, a.duration_seconds || 0)}/km`,
        avgHr: a.avg_hr ?? null,
        imageUrl: a.image_url || null,
        description: a.feeling_notes || a.description || null,
        privacy: a.privacy || 'public',
      }));

      setRecent(mapped);
      const first = mapped[0];
      if (first) {
        setSelectedId(first.id);
        setCaption(first.description || '');
        setPrivacy(first.privacy);
        setPhotoDataUrl(first.imageUrl);
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar suas atividades.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
    } else {
      setCaption('');
      setPhotoDataUrl(null);
      setSelectedId(null);
      setError(null);
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  const selected = recent.find((a) => a.id === selectedId) || null;

  const handleSelect = (activity: SelectableActivity) => {
    setSelectedId(activity.id);
    setCaption(activity.description || '');
    setPrivacy(activity.privacy);
    setPhotoDataUrl(activity.imageUrl);
  };

  const handlePickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      setPhotoDataUrl(prepared.dataUrl);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível preparar a imagem.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await activitiesApi.update(selected.id, {
        feeling_notes: caption.trim(),
        privacy,
        image_url: photoDataUrl,
      });
      onPosted();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível publicar.');
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Autor e privacidade */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={athlete.avatarUrl}
                alt={athlete.name}
                className="w-10 h-10 rounded-full object-cover border border-[#353534] shrink-0"
              />
              <div className="min-w-0">
                <span className="font-bold text-sm text-[#F7F5F3] block truncate">{athlete.name}</span>
                <span className="text-xs text-[#A1A1AA] truncate block">
                  {athlete.handle} • Atleta {athlete.category}
                </span>
              </div>
            </div>

            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as any)}
              aria-label="Privacidade da publicação"
              className="bg-[#1C1C1C] border border-[#262626] text-[#F7F5F3] text-xs py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-[#FF5500] cursor-pointer shrink-0"
            >
              <option value="public">🌐 Público (Todos)</option>
              <option value="followers">👥 Pelotão (Seguidores)</option>
              <option value="private">🔒 Apenas Eu</option>
            </select>
          </div>

          {isLoading && (
            <p className="text-xs text-[#737373] animate-pulse">Carregando suas atividades…</p>
          )}

          {!isLoading && recent.length === 0 && (
            <div className="bg-[#1C1C1C] rounded-2xl border border-dashed border-[#262626] p-6 text-center">
              <span className="material-symbols-outlined text-[30px] text-[#404040]">directions_run</span>
              <p className="text-xs text-[#737373] mt-2 leading-relaxed">
                Você ainda não tem nenhuma corrida registrada. Execute um treino pelo HUD para poder publicar.
              </p>
            </div>
          )}

          {recent.length > 0 && (
            <>
              {/* Legenda */}
              <div className="space-y-1">
                <textarea
                  rows={4}
                  value={caption}
                  maxLength={MAX_CAPTION}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Compartilhe percepção de esforço, ritmo, nutrição ou estratégia de prova..."
                  className="w-full bg-[#1C1C1C] border border-[#262626] rounded-2xl p-3.5 text-xs text-[#F7F5F3] placeholder-[#737373] focus:outline-none focus:border-[#FF5500] resize-none leading-relaxed"
                />
                <div className="flex justify-end text-[11px] font-telemetry text-[#737373]">
                  {caption.length} / {MAX_CAPTION} caracteres
                </div>
              </div>

              {/* Seleção da atividade */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
                  Treino sincronizado anexo
                </span>

                {recent.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recent.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelect(a)}
                        className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                          a.id === selectedId
                            ? 'bg-[#FF5500]/15 border-[#FF5500] text-[#F7F5F3]'
                            : 'bg-[#1C1C1C] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                        }`}
                      >
                        <span className="block text-[11px] font-bold truncate max-w-[150px]">{a.title}</span>
                        <span className="block text-[10px] font-telemetry">{timeAgo(a.date)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selected && (
                  <div className="bg-[#1C1C1C] p-3.5 rounded-2xl border border-[#22C55E]/40 shadow-md space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[#22C55E] text-[20px]">verified</span>
                        <span className="font-headline text-base text-[#F7F5F3] uppercase tracking-wide truncate">
                          {selected.title}
                        </span>
                      </div>
                      <span className="font-telemetry text-xs text-[#22C55E] font-bold shrink-0">
                        {formatDuration(selected.durationSeconds)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-telemetry">
                      <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                        <span className="text-[9px] text-[#A1A1AA] uppercase block">KM</span>
                        <span className="font-bold text-[#F7F5F3] block mt-0.5">
                          {selected.distanceKm.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                        <span className="text-[9px] text-[#A1A1AA] uppercase block">RITMO</span>
                        <span className="font-bold text-[#FF5500] block mt-0.5">{selected.avgPace}</span>
                      </div>
                      <div className="bg-[#101010] p-2 rounded-lg border border-[#262626]">
                        <span className="text-[9px] text-[#A1A1AA] uppercase block">BPM</span>
                        <span className="font-bold text-[#EF4444] block mt-0.5">{selected.avgHr ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Foto */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">Foto do treino</span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickPhoto}
                  className="hidden"
                />

                {photoDataUrl ? (
                  <div className="relative h-44 rounded-2xl overflow-hidden border border-[#262626] bg-[#101010]">
                    <img src={photoDataUrl} alt="Foto do treino" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {showHudSticker && selected && (
                      <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
                        <span className="font-headline text-white">
                          RUSH HUD • {selected.distanceKm.toFixed(1)} KM
                        </span>
                        <span className="font-telemetry text-[#FF5500] font-bold">{selected.avgPace}</span>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-black/70 text-white text-[10px] font-telemetry px-2 py-1 rounded border border-white/20 cursor-pointer hover:bg-black"
                      >
                        TROCAR
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrl(null)}
                        className="bg-black/70 text-white text-[10px] font-telemetry px-2 py-1 rounded border border-white/20 cursor-pointer hover:bg-black"
                      >
                        REMOVER
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-28 rounded-2xl border border-dashed border-[#353534] bg-[#101010] flex flex-col items-center justify-center gap-1 text-[#737373] hover:text-[#F7F5F3] hover:border-[#FF5500]/50 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[26px]">add_photo_alternate</span>
                    <span className="text-xs font-bold uppercase">Anexar foto do treino</span>
                  </button>
                )}
              </div>

              {/* Sticker */}
              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] text-xs">
                <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
                  <span className="text-[#F7F5F3] font-bold">Sobrepor sticker RUSH HUD na imagem</span>
                  <input
                    type="checkbox"
                    checked={showHudSticker}
                    onChange={(e) => setShowHudSticker(e.target.checked)}
                    className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer"
                  />
                </label>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-[#EF4444] font-bold" role="alert">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!selected || isSubmitting}
              className="w-full min-h-[54px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#FF5500]/30 font-headline text-lg uppercase tracking-wider transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">send</span>
              <span>{isSubmitting ? 'Publicando…' : 'Publicar no Feed da Comunidade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
