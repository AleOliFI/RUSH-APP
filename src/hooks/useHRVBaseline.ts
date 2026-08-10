import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import {
  calculateBaseline,
  calculateCV,
  classifyHRVStatus,
  classifyRHRStatus,
  calculateRHRBaseline,
  calculateBaselines,
} from '../lib/algorithms/hrv';
import type { HRVMetric, HRVReading } from '../types/hrv';

export function useHRVHistory(days = 28) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['hrv-history', user?.id, days],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const { data, error } = await supabase
        .from('hrv_readings')
        .select('*')
        .eq('user_id', user!.id)
        .gte('measured_at', cutoff.toISOString())
        .order('measured_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as HRVReading[];
    },
  });
}

/**
 * Baselines de uma métrica só.
 *
 * RMSSD (cintas BLE) e SDNN (Apple Health) medem componentes diferentes da
 * variabilidade: 40 ms de um não significa o mesmo que 40 ms do outro. Antes,
 * só o calculateBaselines particionava, enquanto readingCount, baseline7d,
 * cv7d e rhrBaseline usavam as leituras misturadas — e bastava a primeira
 * leitura SDNN para o app se declarar calibrado com contagem de uma métrica
 * comparada contra a baseline de outra.
 */
export function useHRVBaseline(metric: HRVMetric = 'rmssd') {
  const { data: allReadings = [] } = useHRVHistory(28);

  const readings = allReadings.filter((r) => (r.hrv_metric ?? 'rmssd') === metric);

  const baseline7d = calculateBaseline(readings, 7);
  const baseline28d = calculateBaseline(readings, 28);
  const cv7d = calculateCV(readings.slice(0, 7));
  const rhrBaseline = calculateRHRBaseline(readings);
  const baselines = calculateBaselines(readings, metric);

  return {
    baseline7d,
    baseline28d,
    cv7d,
    rhrBaseline,
    readingCount: readings.length,
    mu7SVC: baselines.mu7SVC,
    mu28SVC: baselines.mu28SVC,
    sigma28SVC: baselines.sigma28SVC,
    sigma28: baselines.sigma28,
    rhrMu28: baselines.rhrMu28,
  };
}

export function useCurrentHRVStatus(
  latestRMSSD: number,
  latestRHR: number | null,
  metric: HRVMetric = 'rmssd',
) {
  const { baseline7d, rhrBaseline, readingCount } = useHRVBaseline(metric);

  const hrvStatus = classifyHRVStatus(latestRMSSD, baseline7d, readingCount);
  const rhrStatus =
    latestRHR && rhrBaseline > 0
      ? classifyRHRStatus(latestRHR, rhrBaseline)
      : 'normal';

  return { hrvStatus, rhrStatus };
}
