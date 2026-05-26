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
import type { HRVReading } from '../types/hrv';

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

export function useHRVBaseline() {
  const { data: readings = [] } = useHRVHistory(28);

  const baseline7d = calculateBaseline(readings, 7);
  const baseline28d = calculateBaseline(readings, 28);
  const cv7d = calculateCV(readings.slice(0, 7));
  const rhrBaseline = calculateRHRBaseline(readings);
  const baselines = calculateBaselines(readings);

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

export function useCurrentHRVStatus(latestRMSSD: number, latestRHR: number | null) {
  const { baseline7d, rhrBaseline, readingCount } = useHRVBaseline();

  const hrvStatus = classifyHRVStatus(latestRMSSD, baseline7d, readingCount);
  const rhrStatus =
    latestRHR && rhrBaseline > 0
      ? classifyRHRStatus(latestRHR, rhrBaseline)
      : 'normal';

  return { hrvStatus, rhrStatus };
}
