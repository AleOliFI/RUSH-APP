// ============================================================
// RUSH RUNNING — Exportador de Story 9:16
// ------------------------------------------------------------
// A arte é renderizada de verdade num canvas 1080x1920 com os
// números da atividade escolhida e baixada como PNG. O protótipo
// baixava a foto de fundo original sem nenhum dado sobreposto.
//
// Exportação animada (vídeo/GIF) não está disponível: gerar vídeo no
// navegador exige codificação em tempo real que este app não faz. Em
// vez de oferecer um botão que entrega um PNG, a tela diz isso.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activities as activitiesApi } from '../../api';
import { formatDuration, paceFromActivity, timeAgo } from '../../data/adapters';
import {
  canvasToBlob,
  renderStoryCanvas,
  STORY_HEIGHT,
  STORY_WIDTH,
  StoryData,
} from '../../utils/storyCanvas';
import { prepareImageForUpload } from '../../utils/imageUpload';

interface StoryExporterModalProps {
  isOpen: boolean;
  athleteName: string;
  defaultShoeName?: string | null;
  onClose: () => void;
}

const ACCENT_COLORS = ['#FF5500', '#FFFFFF', '#C3F400', '#00E5FF'] as const;

export const StoryExporterModal: React.FC<StoryExporterModalProps> = ({
  isOpen,
  athleteName,
  defaultShoeName,
  onClose,
}) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string>(ACCENT_COLORS[0]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [showHr, setShowHr] = useState(true);
  const [showShoe, setShowShoe] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const selected = useMemo(
    () => activities.find((a) => a.id === selectedId) || null,
    [activities, selectedId],
  );

  const storyData: StoryData | null = useMemo(() => {
    if (!selected) return null;
    const distance = selected.distance_km || 0;
    const duration = selected.duration_seconds || 0;
    return {
      title: selected.title || 'Sessão RUSH',
      distanceKm: distance,
      duration: formatDuration(duration),
      avgPace: selected.avg_pace || `${paceFromActivity(distance, duration)}/km`,
      avgHr: selected.avg_hr ?? null,
      dateLabel: timeAgo(selected.date),
      shoeName: defaultShoeName || null,
      locationLabel: athleteName,
    };
  }, [selected, defaultShoeName, athleteName]);

  /* ---------- carrega atividades ---------- */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await activitiesApi.list(1);
        if (cancelled) return;
        const list = (data.activities || []).slice(0, 10);
        setActivities(list);
        if (list[0]) {
          setSelectedId(list[0].id);
          setBackgroundUrl(list[0].image_url || null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Não foi possível carregar suas atividades.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  /* ---------- gera a pré-visualização ---------- */
  const renderPreview = useCallback(async () => {
    if (!storyData) return;
    setIsRendering(true);
    setError(null);
    try {
      const canvas = await renderStoryCanvas(storyData, {
        accentColor,
        backgroundImageUrl: backgroundUrl,
        showHr,
        showShoe,
      });
      const blob = await canvasToBlob(canvas);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar a arte.');
    } finally {
      setIsRendering(false);
    }
  }, [storyData, accentColor, backgroundUrl, showHr, showShoe]);

  useEffect(() => {
    if (isOpen && storyData) renderPreview();
  }, [isOpen, storyData, renderPreview]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    },
    [],
  );

  if (!isOpen) return null;

  const handlePickBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      setBackgroundUrl(prepared.dataUrl);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível preparar a imagem.');
    }
  };

  const handleDownload = async () => {
    if (!storyData) return;
    setIsRendering(true);
    setError(null);
    try {
      const canvas = await renderStoryCanvas(storyData, {
        accentColor,
        backgroundImageUrl: backgroundUrl,
        showHr,
        showShoe,
      });
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rush-story-${storyData.distanceKm.toFixed(1)}km.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setFeedback('Imagem 1080x1920 salva no dispositivo.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível exportar.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleShare = async () => {
    if (!storyData) return;
    setError(null);
    try {
      const canvas = await renderStoryCanvas(storyData, {
        accentColor,
        backgroundImageUrl: backgroundUrl,
        showHr,
        showShoe,
      });
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], `rush-story-${storyData.distanceKm.toFixed(1)}km.png`, {
        type: 'image/png',
      });

      const nav: any = navigator;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'RUSH RUNNING',
          text: `${storyData.distanceKm.toFixed(2)} km a ${storyData.avgPace}.`,
        });
        return;
      }

      setFeedback('Compartilhamento de arquivo indisponível aqui — use o download.');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Não foi possível compartilhar.');
      }
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

      <div className="relative w-full max-w-xl mx-auto max-h-[94vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626] gap-3">
          <div className="min-w-0">
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              COMPARTILHAMENTO
            </span>
            <h2 id="story-exporter-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Story 9:16
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar exportador"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading && <p className="text-xs text-[#737373] animate-pulse">Carregando atividades…</p>}

          {!isLoading && activities.length === 0 && (
            <div className="bg-[#1C1C1C] rounded-2xl border border-dashed border-[#262626] p-6 text-center">
              <span className="material-symbols-outlined text-[30px] text-[#404040]">image</span>
              <p className="text-xs text-[#737373] mt-2 leading-relaxed">
                Você precisa de pelo menos uma corrida registrada para gerar um story.
              </p>
            </div>
          )}

          {activities.length > 0 && (
            <>
              {/* Pré-visualização real */}
              <div className="flex justify-center">
                <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden border border-[#FF5500]/40 shadow-2xl bg-black">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Pré-visualização do story" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-telemetry text-xs text-[#737373] animate-pulse">
                        Gerando arte…
                      </span>
                    </div>
                  )}

                  {isRendering && previewUrl && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white animate-spin text-[28px]">
                        progress_activity
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-[#737373] text-center font-telemetry">
                {STORY_WIDTH} × {STORY_HEIGHT} px • PNG
              </p>

              {/* Atividade */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">Atividade</span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {activities.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedId(a.id);
                        setBackgroundUrl(a.image_url || null);
                      }}
                      className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                        a.id === selectedId
                          ? 'bg-[#FF5500]/15 border-[#FF5500] text-[#F7F5F3]'
                          : 'bg-[#1C1C1C] border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                      }`}
                    >
                      <span className="block text-[11px] font-bold truncate max-w-[150px]">
                        {a.title || 'Atividade'}
                      </span>
                      <span className="block text-[10px] font-telemetry">
                        {(a.distance_km || 0).toFixed(1)} km • {timeAgo(a.date)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fundo */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">Imagem de fundo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickBackground}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-11 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] text-[11px] font-bold uppercase text-[#F7F5F3] cursor-pointer"
                  >
                    {backgroundUrl ? 'Trocar foto' : 'Escolher foto'}
                  </button>
                  {backgroundUrl && (
                    <button
                      onClick={() => setBackgroundUrl(null)}
                      className="h-11 px-4 rounded-xl bg-[#101010] border border-[#262626] text-[11px] font-bold uppercase text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Cor de destaque */}
              <div className="space-y-2">
                <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">Cor de destaque</span>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      aria-label={`Cor ${color}`}
                      className={`w-11 h-11 rounded-xl border-2 transition-all cursor-pointer ${
                        accentColor === color ? 'border-white scale-105' : 'border-[#262626]'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Dados no cartão */}
              <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-1 text-xs">
                <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
                  <span className="text-[#F7F5F3] font-bold">Mostrar frequência cardíaca</span>
                  <input
                    type="checkbox"
                    checked={showHr}
                    onChange={(e) => setShowHr(e.target.checked)}
                    className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer"
                  />
                </label>
                <div className="border-t border-[#262626]" />
                <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
                  <span className="text-[#F7F5F3] font-bold">Mostrar calçado usado</span>
                  <input
                    type="checkbox"
                    checked={showShoe}
                    onChange={(e) => setShowShoe(e.target.checked)}
                    disabled={!defaultShoeName}
                    className="accent-[#FF5500] w-4 h-4 rounded cursor-pointer disabled:opacity-40"
                  />
                </label>
              </div>

              {feedback && (
                <p className="text-xs text-[#22C55E] font-bold" role="status">
                  {feedback}
                </p>
              )}
              {error && (
                <p className="text-xs text-[#EF4444] font-bold" role="alert">
                  {error}
                </p>
              )}

              {/* Ações */}
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={handleDownload}
                  disabled={isRendering}
                  className="w-full min-h-[52px] py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait text-[#0D0D0D] rounded-xl flex items-center justify-center gap-2 shadow-lg font-headline text-base uppercase tracking-wider transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">download</span>
                  <span>{isRendering ? 'Gerando…' : 'Baixar PNG 1080x1920'}</span>
                </button>

                <button
                  onClick={handleShare}
                  disabled={isRendering}
                  className="w-full min-h-[48px] py-3 px-4 bg-[#262626] hover:bg-[#353534] disabled:opacity-60 text-[#F7F5F3] rounded-xl border border-[#353534] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Compartilhar direto
                </button>
              </div>

              <p className="text-[10px] text-[#737373] leading-relaxed">
                A exportação gera uma imagem estática. Story animado em vídeo ou GIF exigiria codificação de
                vídeo no dispositivo, que o app ainda não faz.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
