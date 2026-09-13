// ============================================================
// RUSH RUNNING — Percurso da atividade
// ------------------------------------------------------------
// Desenha a polilinha bruta do GPS (projeção equiretangular local,
// suficiente na escala de uma corrida) e permite baixar o .GPX.
// Só mostra o que foi medido: altimetria e elevação não aparecem
// quando o dispositivo não reportou altitude.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { activities as activitiesApi } from '../../api';

export interface RouteTrackPoint {
  lat: number;
  lon: number;
  t: number | null;
  acc: number | null;
  alt: number | null;
}

interface RouteMapModalProps {
  activityId: string | null;
  title?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const VIEW_W = 320;
const VIEW_H = 320;
const PADDING = 16;

/** Converte os pontos em coordenadas de tela mantendo a proporção real. */
function buildPath(points: RouteTrackPoint[]): { d: string; start: [number, number]; end: [number, number] } | null {
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Ajuste de longitude pelo cosseno da latitude média: sem isso o traçado
  // fica esticado no eixo leste-oeste.
  const latMid = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const spanX = Math.max((maxLon - minLon) * Math.cos(latMid), 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min((VIEW_W - PADDING * 2) / spanX, (VIEW_H - PADDING * 2) / spanY);

  const offsetX = (VIEW_W - spanX * scale) / 2;
  const offsetY = (VIEW_H - spanY * scale) / 2;

  const project = (p: RouteTrackPoint): [number, number] => [
    offsetX + (p.lon - minLon) * Math.cos(latMid) * scale,
    // y invertido: latitude cresce para o norte, o SVG cresce para baixo.
    VIEW_H - (offsetY + (p.lat - minLat) * scale),
  ];

  const projected = points.map(project);
  const d = projected.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');

  return { d, start: projected[0], end: projected[projected.length - 1] };
}

export const RouteMapModal: React.FC<RouteMapModalProps> = ({ activityId, title, isOpen, onClose }) => {
  const [points, setPoints] = useState<RouteTrackPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen || !activityId) return;
    let cancelled = false;

    setIsLoading(true);
    setError('');
    setPoints(null);

    activitiesApi
      .get(activityId)
      .then((data: any) => {
        if (cancelled) return;
        const track: RouteTrackPoint[] | null = data?.track ?? null;
        if (!track || track.length === 0) {
          setError('Esta atividade não tem traçado GPS gravado.');
        } else {
          setPoints(track);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Erro ao carregar o percurso');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activityId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const path = useMemo(() => (points ? buildPath(points) : null), [points]);

  const altitudes = useMemo(
    () => (points || []).map((p) => p.alt).filter((a): a is number => a != null),
    [points],
  );

  const accuracyAvg = useMemo(() => {
    const values = (points || []).map((p) => p.acc).filter((a): a is number => a != null);
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [points]);

  const handleDownloadGpx = useCallback(async () => {
    if (!activityId || isDownloading) return;
    setIsDownloading(true);
    setError('');
    try {
      const gpx = await activitiesApi.gpx(activityId);
      const blob = new Blob([gpx], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rush-${activityId}.gpx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Erro ao exportar o percurso');
    } finally {
      setIsDownloading(false);
    }
  }, [activityId, isDownloading]);

  if (!isOpen || !activityId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0D0D0D]/95 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Percurso da atividade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-3xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
              Percurso registrado
            </span>
            <h2 className="font-headline text-xl text-[#F7F5F3] uppercase truncate">{title || 'Atividade'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="bg-[#101010] border border-[#262626] rounded-2xl aspect-square flex items-center justify-center overflow-hidden">
          {isLoading && <span className="text-xs text-[#737373]">Carregando percurso…</span>}

          {!isLoading && path && (
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full" role="img" aria-label="Traçado do percurso">
              <path d={path.d} fill="none" stroke="#FF5500" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={path.start[0]} cy={path.start[1]} r="5" fill="#22C55E" />
              <circle cx={path.end[0]} cy={path.end[1]} r="5" fill="#EF4444" />
            </svg>
          )}

          {!isLoading && !path && !error && (
            <span className="text-xs text-[#737373]">Pontos insuficientes para desenhar o percurso.</span>
          )}

          {!isLoading && error && <span className="text-xs text-[#EF4444] px-6 text-center">{error}</span>}
        </div>

        {points && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-2.5">
              <span className="font-telemetry text-[9px] text-[#A1A1AA] uppercase block">Pontos</span>
              <span className="font-headline text-lg text-[#F7F5F3]">{points.length}</span>
            </div>
            <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-2.5">
              <span className="font-telemetry text-[9px] text-[#A1A1AA] uppercase block">Precisão méd.</span>
              <span className="font-headline text-lg text-[#F7F5F3]">
                {accuracyAvg != null ? `${accuracyAvg.toFixed(0)} m` : '—'}
              </span>
            </div>
            <div className="bg-[#1C1C1C] border border-[#262626] rounded-xl p-2.5">
              <span className="font-telemetry text-[9px] text-[#A1A1AA] uppercase block">Altitude</span>
              <span className="font-headline text-lg text-[#F7F5F3]">
                {altitudes.length > 0
                  ? `${Math.round(Math.min(...altitudes))}–${Math.round(Math.max(...altitudes))} m`
                  : '—'}
              </span>
            </div>
          </div>
        )}

        {points && altitudes.length === 0 && (
          <p className="text-[10px] text-[#737373] leading-relaxed">
            O dispositivo não reportou altitude nesta corrida, então não há dados de elevação para mostrar.
          </p>
        )}

        <button
          type="button"
          onClick={handleDownloadGpx}
          disabled={isDownloading || !points}
          className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] disabled:cursor-not-allowed text-[#0D0D0D] font-headline text-base uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          <span>{isDownloading ? 'Gerando .GPX…' : 'Baixar .GPX'}</span>
        </button>
      </div>
    </div>
  );
};
