import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { localToday, localDaysAgo } from '../lib/dates';
import type { ReadinessAssessment } from '../types/readiness';

export function useTodayReadiness() {
  const { user } = useAuthStore();
  const today = localToday();

  return useQuery({
    queryKey: ['readiness', user?.id, today],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('readiness_assessments')
        .select('*')
        .eq('user_id', user!.id)
        .eq('assessed_at', today)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ReadinessAssessment | null;
    },
  });
}

export function useReadinessHistory(days = 7) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['readiness-history', user?.id, days],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('readiness_assessments')
        .select('*')
        .eq('user_id', user!.id)
        .gte('assessed_at', localDaysAgo(days))
        .order('assessed_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ReadinessAssessment[];
    },
  });
}
