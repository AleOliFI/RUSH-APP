import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  monthlyDays: number;
  monthlyTotal: number;
  monthlyPct: number;
  measuredToday: boolean;
}

export function useStreak(): StreakData {
  const { user } = useAuthStore();

  const { data } = useQuery<StreakData>({
    queryKey: ['streak', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      // 60 days back is enough to compute the longest streak in 2 months
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);

      const { data: rows } = await supabase
        .from('readiness_assessments')
        .select('assessed_at')
        .eq('user_id', user!.id)
        .gte('assessed_at', cutoff.toISOString())
        .order('assessed_at', { ascending: false });

      const dates = new Set(
        (rows ?? []).map((r) => r.assessed_at.split('T')[0]),
      );

      const todayStr = now.toISOString().split('T')[0];
      const measuredToday = dates.has(todayStr);

      // Current consecutive streak (counting from today or yesterday)
      let currentStreak = 0;
      const cursor = new Date(now);
      // If not measured today, check if yesterday starts the streak
      if (!measuredToday) cursor.setDate(cursor.getDate() - 1);
      while (dates.has(cursor.toISOString().split('T')[0])) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      // Longest streak in the 60-day window
      let longestStreak = 0;
      let run = 0;
      const windowCursor = new Date(now);
      for (let i = 0; i < 60; i++) {
        const d = windowCursor.toISOString().split('T')[0];
        if (dates.has(d)) {
          run++;
          if (run > longestStreak) longestStreak = run;
        } else {
          run = 0;
        }
        windowCursor.setDate(windowCursor.getDate() - 1);
      }

      // Monthly consistency
      const daysElapsed = now.getDate(); // 1-based day of month
      let monthlyDays = 0;
      const monthCursor = new Date(startOfMonth);
      while (monthCursor <= now) {
        if (dates.has(monthCursor.toISOString().split('T')[0])) monthlyDays++;
        monthCursor.setDate(monthCursor.getDate() + 1);
      }
      const monthlyPct = Math.round((monthlyDays / daysElapsed) * 100);

      return {
        currentStreak,
        longestStreak,
        monthlyDays,
        monthlyTotal: daysElapsed,
        monthlyPct,
        measuredToday,
      };
    },
  });

  return (
    data ?? {
      currentStreak: 0,
      longestStreak: 0,
      monthlyDays: 0,
      monthlyTotal: new Date().getDate(),
      monthlyPct: 0,
      measuredToday: false,
    }
  );
}
