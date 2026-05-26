import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WellbeingForm } from '../../src/components/measurement/WellbeingForm';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth';
import { useHRVHistory, useHRVBaseline } from '../../src/hooks/useHRVBaseline';
import {
  classifyHRVStatus,
  classifyRHRStatus,
  classifyWellbeingStatus,
} from '../../src/lib/algorithms/hrv';
import { evaluateReadiness } from '../../src/lib/algorithms/readiness';
import type { WellbeingInput } from '../../src/types/hrv';

export default function WellbeingScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{
    rmssd: string;
    rhr: string;
    quality: string;
    rrIntervals: string;
  }>();
  const [loading, setLoading] = useState(false);
  const { data: readings = [] } = useHRVHistory(28);
  const { baseline7d, rhrBaseline, cv7d, readingCount } = useHRVBaseline();

  const rmssd = parseFloat(params.rmssd ?? '0');
  const rhr = parseInt(params.rhr ?? '0', 10);
  const quality = parseFloat(params.quality ?? '0');

  async function handleSubmit(wb: WellbeingInput) {
    if (!user) return;
    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Save HRV reading
      const { data: hrvReading, error: hrvError } = await supabase
        .from('hrv_readings')
        .insert({
          user_id: user.id,
          rmssd,
          rhr: rhr > 0 ? rhr : null,
          measurement_method: 'camera_ppg',
          duration_seconds: 60,
          quality_score: quality,
          raw_rr_intervals: params.rrIntervals ? JSON.parse(params.rrIntervals) : null,
        })
        .select()
        .single();

      if (hrvError) throw hrvError;

      // 2. Save well-being log
      const { data: wbLog, error: wbError } = await supabase
        .from('wellbeing_logs')
        .insert({ user_id: user.id, ...wb })
        .select()
        .single();

      if (wbError) throw wbError;

      // 3. Compute readiness
      const allReadings = [{ rmssd, rhr: rhr || null } as any, ...readings];
      const hrvStatus = classifyHRVStatus(rmssd, baseline7d, readingCount + 1);
      const rhrStatus = rhr > 0 && rhrBaseline > 0
        ? classifyRHRStatus(rhr, rhrBaseline)
        : 'normal';
      const wbScore = wbLog.wellbeing_score ?? 3;
      const wbStatus = classifyWellbeingStatus(wbScore);
      const readiness = evaluateReadiness(hrvStatus, rhrStatus, wbStatus);

      // 4. Save assessment
      const { data: assessment, error: assessError } = await supabase
        .from('readiness_assessments')
        .upsert({
          user_id: user.id,
          assessed_at: today,
          hrv_reading_id: hrvReading.id,
          wellbeing_log_id: wbLog.id,
          hrv_status: hrvStatus,
          rhr_status: rhrStatus,
          wellbeing_status: wbStatus,
          readiness_state: readiness.state,
          readiness_color: readiness.color,
          readiness_score: readiness.score,
          training_directive: readiness.directive,
          prescription_text: readiness.description,
          example_session: readiness.example_session,
          baseline_rmssd_7d: baseline7d > 0 ? baseline7d : null,
          cv_7d: cv7d > 0 ? cv7d : null,
        })
        .select()
        .single();

      if (assessError) throw assessError;

      // 5. Mark onboarding complete on first measurement
      if (readingCount === 0) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      }

      router.replace({
        pathname: '/measurement/result',
        params: { assessmentId: assessment.id },
      });
    } catch (e) {
      console.error('Error saving measurement:', e);
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <View className="flex-1">
        <WellbeingForm onSubmit={handleSubmit} loading={loading} />
      </View>
    </SafeAreaView>
  );
}
