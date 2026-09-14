// ============================================================
// RUSH RUNNING — Histórico de treinos (calendário, lista, carga)
// ------------------------------------------------------------
// Carrega o mês inteiro de uma vez (a listagem aceita janela de
// datas) e deriva daí o calendário, o resumo da semana e a lista
// do dia. Trocar de mês é a única coisa que refaz requisição.
//
// A intensidade de cada sessão NÃO existe no banco: é derivada da
// FC média contra as zonas do atleta e, na falta dela, do RPE
// informado. Quando não há nem um nem outro, a sessão fica como
// 'indefinida' em vez de receber uma categoria inventada.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { activities as activitiesApi } from '../api';
import type { HrZone } from './useTrainingReference';

export type SessionIntensity = 'hiit' | 'tempo' | 'regen' | 'indefinida';

export interface HistoryActivity {
  id: string;
  type: string;
  title: string | null;
  date: string;
  distance_km: number;
  duration_seconds: number;
  avg_pace: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  rpe_score: number | null;
  feeling_notes: string | null;
  description: string | null;
  image_url: string | null;
  shoe_id: string | null;
  has_track: boolean;
  has_hr_series: boolean;
  /** Derivada, nunca lida do banco. */
  intensity: SessionIntensity;
  /** Como a intensidade foi obtida — a interface deve deixar isso claro. */
  intensitySource: 'fc' | 'rpe' | 'nenhuma';
}

export interface DayBucket {
  /** YYYY-MM-DD */
  date: string;
  activities: HistoryActivity[];
  distanceKm: number;
  intensities: SessionIntensity[];
}

export interface PeriodSummary {
  distanceKm: number;
  movingSeconds: number;
  activityCount: number;
  /** Null quando não houve distância no período: não há pace a mostrar. */
  avgPace: string | null;
}

export interface ActivityHistoryData {
  /** Primeiro dia do mês exibido. */
  month: Date;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  /** Verdadeiro quando o mês exibido já é o atual — não há futuro para navegar. */
  isCurrentMonth: boolean;

  selectedDate: string;
  selectDate: (date: string) => void;

  /** Todos os dias com atividade no mês, indexados por YYYY-MM-DD. */
  days: Record<string, DayBucket>;
  /** Atividades do dia selecionado, já filtradas pelo tipo escolhido. */
  selectedDayActivities: HistoryActivity[];
  /** Mês inteiro, em ordem decrescente, para a aba de lista. */
  monthActivities: HistoryActivity[];

  monthSummary: PeriodSummary;
  /** Semana (segunda a domingo) que contém o dia selecionado. */
  weekSummary: PeriodSummary;
  weekRange: { start: string; end: string };

  typeFilter: string | null;
  setTypeFilter: (type: string | null) => void;
  /** Tipos presentes no mês, para montar os filtros sem opções vazias. */
  availableTypes: string[];

  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Segunda-feira da semana que contém a data. */
function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const weekday = (result.getDay() + 6) % 7; // 0 = segunda
  result.setDate(result.getDate() - weekday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatPaceFromSeconds(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${pad(seconds)}/km`;
}

function summarize(list: HistoryActivity[]): PeriodSummary {
  const distanceKm = list.reduce((sum, a) => sum + (a.distance_km || 0), 0);
  const movingSeconds = list.reduce((sum, a) => sum + (a.duration_seconds || 0), 0);
  return {
    distanceKm: +distanceKm.toFixed(1),
    movingSeconds,
    activityCount: list.length,
    avgPace: distanceKm > 0 ? formatPaceFromSeconds(movingSeconds / distanceKm) : null,
  };
}

/**
 * Classifica a sessão pela FC média contra as zonas do atleta; sem FC, cai
 * para o RPE de Foster. Sem nenhum dos dois, fica indefinida — o calendário
 * mostra um marcador neutro em vez de fingir que sabe a intensidade.
 */
function classifyIntensity(
  activity: any,
  zones: Record<string, HrZone>,
): { intensity: SessionIntensity; intensitySource: HistoryActivity['intensitySource'] } {
  const avgHr = Number(activity.avg_hr);
  if (isFinite(avgHr) && avgHr > 0 && zones?.Z4?.minBpm) {
    if (avgHr >= zones.Z4.minBpm) return { intensity: 'hiit', intensitySource: 'fc' };
    if (avgHr >= zones.Z3.minBpm) return { intensity: 'tempo', intensitySource: 'fc' };
    return { intensity: 'regen', intensitySource: 'fc' };
  }

  const rpe = Number(activity.rpe_score ?? activity.rpe);
  if (isFinite(rpe) && rpe > 0) {
    if (rpe >= 7) return { intensity: 'hiit', intensitySource: 'rpe' };
    if (rpe >= 4) return { intensity: 'tempo', intensitySource: 'rpe' };
    return { intensity: 'regen', intensitySource: 'rpe' };
  }

  return { intensity: 'indefinida', intensitySource: 'nenhuma' };
}

export function useActivityHistory(zones: Record<string, HrZone> = {}): ActivityHistoryData {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toIsoDay(today));
  const [raw, setRaw] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthStart = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const monthEnd = useMemo(
    () => new Date(month.getFullYear(), month.getMonth() + 1, 0),
    [month],
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // O mês inteiro cabe folgado no teto de 100 por página.
      const res = await activitiesApi.list(1, {
        limit: 100,
        from: `${toIsoDay(monthStart)}T00:00:00.000Z`,
        to: `${toIsoDay(monthEnd)}T23:59:59.999Z`,
      });
      setRaw(res?.activities || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar o histórico de treinos');
      setRaw([]);
    } finally {
      setIsLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    reload();
  }, [reload]);

  const monthActivities = useMemo<HistoryActivity[]>(
    () =>
      raw.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title ?? null,
        date: a.date,
        distance_km: Number(a.distance_km) || 0,
        duration_seconds: Number(a.duration_seconds) || 0,
        avg_pace: a.avg_pace ?? null,
        avg_hr: a.avg_hr ?? null,
        max_hr: a.max_hr ?? null,
        rpe_score: a.rpe_score ?? a.rpe ?? null,
        feeling_notes: a.feeling_notes ?? null,
        description: a.description ?? null,
        image_url: a.image_url ?? null,
        shoe_id: a.shoe_id ?? null,
        has_track: !!a.has_track,
        has_hr_series: !!a.has_hr_series,
        ...classifyIntensity(a, zones),
      })),
    [raw, zones],
  );

  const filtered = useMemo(
    () => (typeFilter ? monthActivities.filter((a) => a.type === typeFilter) : monthActivities),
    [monthActivities, typeFilter],
  );

  const days = useMemo(() => {
    const buckets: Record<string, DayBucket> = {};
    for (const activity of filtered) {
      const day = activity.date.split('T')[0];
      if (!buckets[day]) {
        buckets[day] = { date: day, activities: [], distanceKm: 0, intensities: [] };
      }
      buckets[day].activities.push(activity);
      buckets[day].distanceKm = +(buckets[day].distanceKm + activity.distance_km).toFixed(1);
      if (!buckets[day].intensities.includes(activity.intensity)) {
        buckets[day].intensities.push(activity.intensity);
      }
    }
    return buckets;
  }, [filtered]);

  const weekRange = useMemo(() => {
    const start = startOfWeek(new Date(`${selectedDate}T12:00:00`));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toIsoDay(start), end: toIsoDay(end) };
  }, [selectedDate]);

  const weekSummary = useMemo(
    () =>
      summarize(
        filtered.filter((a) => {
          const day = a.date.split('T')[0];
          return day >= weekRange.start && day <= weekRange.end;
        }),
      ),
    [filtered, weekRange],
  );

  return {
    month: monthStart,
    goToPreviousMonth: () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)),
    goToNextMonth: () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)),
    isCurrentMonth:
      monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth(),

    selectedDate,
    selectDate: setSelectedDate,

    days,
    selectedDayActivities: days[selectedDate]?.activities || [],
    monthActivities: filtered,

    monthSummary: summarize(filtered),
    weekSummary,
    weekRange,

    typeFilter,
    setTypeFilter,
    availableTypes: Array.from(new Set(monthActivities.map((a) => a.type))),

    isLoading,
    error,
    reload,
  };
}
