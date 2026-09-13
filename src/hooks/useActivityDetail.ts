// ============================================================
// RUSH RUNNING — Detalhe, edição e exclusão de atividade
// ------------------------------------------------------------
// Sem esta camada, uma corrida gravada errado fica no histórico
// para sempre. Excluir mexe na carga de treino (ACWR) e na
// quilometragem do calçado — quem chama precisa confirmar antes.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { activities as activitiesApi } from '../api';
import type { RouteTrackPoint } from '../components/rush/RouteMapModal';

/** Faixas aceitas pelo backend; validar antes de enviar evita 400. */
export const ACTIVITY_LIMITS = {
  titleMaxLength: 120,
  textMaxLength: 2000,
  rpeRange: { min: 1, max: 10 },
  ratingRange: { min: 1, max: 5 },
  privacyLevels: ['public', 'followers', 'private'] as const,
};

export type ActivityPrivacy = (typeof ACTIVITY_LIMITS.privacyLevels)[number];

export interface ActivityEditInput {
  title?: string;
  description?: string;
  feeling_notes?: string;
  image_url?: string | null;
  privacy?: ActivityPrivacy;
  rpe_score?: number;
  workout_rating?: number;
  shoe_id?: string | null;
}

export interface ActivityDetailData {
  activity: any | null;
  splits: any[];
  /** Polilinha do GPS; null quando a corrida não foi rastreada pelo app. */
  track: RouteTrackPoint[] | null;
  likes: { count: number; has_liked: boolean; users: any[] };
  comments: { count: number; items: any[] };
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  update: (patch: ActivityEditInput) => Promise<void>;
  remove: () => Promise<void>;
  downloadGpx: () => Promise<void>;
}

export function useActivityDetail(activityId: string | null): ActivityDetailData {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activityId) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(await activitiesApi.get(activityId));
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar a atividade');
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = useCallback(
    async (patch: ActivityEditInput) => {
      if (!activityId || Object.keys(patch).length === 0) return;
      setIsSaving(true);
      setError(null);
      try {
        await activitiesApi.update(activityId, patch);
        await reload();
      } catch (err: any) {
        setError(err?.message || 'Não foi possível salvar a atividade');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [activityId, reload],
  );

  /** Irreversível: recalcula carga de treino e quilometragem do calçado. */
  const remove = useCallback(async () => {
    if (!activityId) return;
    setIsSaving(true);
    setError(null);
    try {
      await activitiesApi.delete(activityId);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir a atividade');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [activityId]);

  const downloadGpx = useCallback(async () => {
    if (!activityId) return;
    setError(null);
    try {
      const gpx = await activitiesApi.gpx(activityId);
      const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `rush-${activityId}.gpx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível exportar o percurso');
      throw err;
    }
  }, [activityId]);

  return {
    activity: data?.activity || null,
    splits: data?.splits || [],
    track: data?.track || null,
    likes: data?.likes || { count: 0, has_liked: false, users: [] },
    comments: data?.comments || { count: 0, items: [] },
    isLoading,
    isSaving,
    error,
    reload,
    update,
    remove,
    downloadGpx,
  };
}
