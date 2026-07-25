import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { WellbeingForm } from '../../src/components/measurement/WellbeingForm';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth';
import { useSubscriptionStore } from '../../src/stores/subscription';
import { useHRVHistory, useHRVBaseline } from '../../src/hooks/useHRVBaseline';
import { useIsPremium } from '../../src/hooks/useSubscription';
import { localToday, localDaysAgo, parseDateOnly } from '../../src/lib/dates';
import {
  classifyHRVStatus,
  classifyRHRStatus,
  classifyWellbeingStatus,
  calculateSVFC,
  calculateSFCR,
  calculateEWB,
} from '../../src/lib/algorithms/hrv';
import {
  evaluateReadiness,
  detectMaleDownregulation,
  estimateCatabolicFactor,
} from '../../src/lib/algorithms/readiness';
import {
  estimateCyclePhase,
  applyLutealCorrection,
  getPrescriptionFeminine,
} from '../../src/lib/algorithms/hormonal';
import type { WellbeingInput, CycleLog, CyclePhase, HormonalProfile } from '../../src/types/hrv';

export default function WellbeingScreen() {
  const { user } = useAuthStore();
  const isPremium = useIsPremium();
  const subLoading = useSubscriptionStore((s) => s.isLoading);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    rmssd: string;
    rhr: string;
    quality: string;
    rrIntervals: string;
  }>();
  const [loading, setLoading] = useState(false);
  const { data: readings = [] } = useHRVHistory(28);
  const { baseline7d, rhrBaseline, cv7d, readingCount, rhrMu28, mu28SVC } = useHRVBaseline();

  const rmssd = parseFloat(params.rmssd ?? '0');
  const rhr = parseInt(params.rhr ?? '0', 10);
  const quality = parseFloat(params.quality ?? '0');

  async function handleSubmit(wb: WellbeingInput) {
    if (!user) return;
    // Wait for the subscription sync to settle so premium logic isn't skipped
    // and baked permanently into the assessment (free-tier race).
    if (subLoading) return;
    setLoading(true);

    try {
      const today = localToday();

      // 1. Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, hormonal_profile')
        .eq('id', user.id)
        .single();

      const gender = profile?.gender as 'male' | 'female' | 'other' | undefined;
      const hormonalProfile = (profile?.hormonal_profile ?? null) as HormonalProfile;

      // 2. Hormonal cycle phase (Premium — Cérebro Endócrino)
      let cyclePhase: CyclePhase = 'unknown';
      let hormonalAdjustment = 1.0;
      let effectiveRmssd = rmssd;

      if (isPremium && gender === 'female') {
        const { data: cycleLog } = await supabase
          .from('cycle_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('cycle_start_date', { ascending: false })
          .limit(1)
          .single();

        if (cycleLog) {
          const cl = cycleLog as CycleLog;
          const startDate = parseDateOnly(cl.cycle_start_date);
          const dayOfCycle =
            Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          cyclePhase = estimateCyclePhase(dayOfCycle);
          effectiveRmssd = applyLutealCorrection(rmssd, cyclePhase);
          hormonalAdjustment = effectiveRmssd / (rmssd || 1);
        }
      }

      // 3. Compute V2 scores
      const sVfc = calculateSVFC(effectiveRmssd);
      const sFcr = calculateSFCR(rhr > 0 ? rhr : rhrMu28, rhrMu28);
      const eWb = calculateEWB(wb.sleep_quality, wb.stress_level, wb.fatigue_level, wb.doms_level);

      // 4. Male downregulation (Premium)
      let penaltyFactor = 1.0;
      let falseReadinessFlag = false;
      if (isPremium && gender === 'male') {
        const [flag, penalty] = detectMaleDownregulation(sVfc, mu28SVC, rhr, eWb);
        if (flag) {
          falseReadinessFlag = true;
          penaltyFactor = penalty;
        }
      }

      // 5. Catabolic factor (Premium)
      let catabolicFlag = false;
      if (isPremium) {
        // readings come newest-first; estimateCatabolicFactor expects oldest-first
        const last5SVC = readings.slice(0, 5).reverse().map((r) => calculateSVFC(r.rmssd));
        const { data: recentSessions } = await supabase
          .from('training_sessions')
          .select('trimp_score')
          .eq('user_id', user.id)
          .gte('session_date', localDaysAgo(3));
        const trimpLast3 = (recentSessions ?? []).reduce(
          (s: number, r: { trimp_score: number | null }) => s + (r.trimp_score ?? 0),
          0,
        );
        catabolicFlag = estimateCatabolicFactor(last5SVC, trimpLast3);
      }

      // 6. Evaluate readiness
      let readiness = evaluateReadiness({
        sVfc,
        sFcr,
        eWb,
        readingCount: readingCount + 1,
        penaltyFactor,
        catabolicFlag,
        falseReadinessFlag,
      });

      // 7. Hormonal prescription override (Premium — Cérebro Endócrino)
      if (isPremium && gender === 'female' && hormonalProfile !== null && readingCount >= 7) {
        const zone =
          readiness.color === 'green' ? 'green' : readiness.color === 'orange' ? 'orange' : 'red';
        const femalePrescription = getPrescriptionFeminine(zone, hormonalProfile, cyclePhase);
        readiness = {
          ...readiness,
          directive: femalePrescription.directive,
          example_session: femalePrescription.session,
        };
      }

      // 8. Save HRV reading
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

      // 9. Save well-being log
      const { data: wbLog, error: wbError } = await supabase
        .from('wellbeing_logs')
        .insert({ user_id: user.id, ...wb })
        .select()
        .single();

      if (wbError) throw wbError;

      // 10. Legacy status fields
      const hrvStatus = classifyHRVStatus(rmssd, baseline7d, readingCount + 1);
      const rhrStatus =
        rhr > 0 && rhrBaseline > 0 ? classifyRHRStatus(rhr, rhrBaseline) : 'normal';
      const wbScore = wbLog.wellbeing_score ?? 3;
      const wbStatus = classifyWellbeingStatus(wbScore);

      // 11. Save assessment
      // onConflict matches unique (user_id, assessed_at): a same-day
      // re-measurement updates in place instead of failing with 23505
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
          readiness_state: 3,
          readiness_color: readiness.color,
          readiness_score: readiness.score,
          training_directive: readiness.directive,
          prescription_text: readiness.description,
          example_session: readiness.example_session,
          baseline_rmssd_7d: baseline7d > 0 ? baseline7d : null,
          cv_7d: cv7d > 0 ? cv7d : null,
          s_vfc: sVfc,
          s_fcr: sFcr,
          e_wb: eWb,
          hormonal_adjustment: hormonalAdjustment,
          false_readiness_flag: falseReadinessFlag,
          cycle_phase: cyclePhase !== 'unknown' ? cyclePhase : null,
          hormonal_profile: hormonalProfile,
        }, { onConflict: 'user_id,assessed_at' })
        .select()
        .single();

      if (assessError) throw assessError;

      if (readingCount === 0) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      }

      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      queryClient.invalidateQueries({ queryKey: ['readiness-history'] });
      queryClient.invalidateQueries({ queryKey: ['hrv-history'] });

      router.replace({
        pathname: '/measurement/result',
        params: { assessmentId: assessment.id },
      });
    } catch (e) {
      console.error('Error saving measurement:', e);
      Alert.alert('Erro', 'Não foi possível salvar sua medição. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <View className="flex-1">
        <WellbeingForm onSubmit={handleSubmit} loading={loading || subLoading} />
      </View>
    </SafeAreaView>
  );
}
