import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { ReadinessRing } from '../../src/components/charts/ReadinessRing';
import { ReadinessBadge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { H2, H3, Body, Label, Caption } from '../../src/components/ui/Typography';
import { DIRECTIVE_LABEL, READINESS_COLOR_HEX } from '../../src/lib/algorithms/readiness';
import { useIsPremium } from '../../src/hooks/useSubscription';
import { BehaviorPicker } from '../../src/components/measurement/BehaviorPicker';
import { useAuthStore } from '../../src/stores/auth';
import type { Behavior } from '../../src/lib/algorithms/behaviors';
import type { ReadinessAssessment } from '../../src/types/readiness';

export default function ResultScreen() {
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();
  const isPremium = useIsPremium();
  const { user } = useAuthStore();

  async function saveBehaviors(behaviors: Behavior[]) {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('behavior_logs')
      .upsert({ user_id: user.id, log_date: today, behaviors }, { onConflict: 'user_id,log_date' });
  }

  const { data: assessment, isLoading, isError } = useQuery({
    queryKey: ['assessment', assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('readiness_assessments')
        .select('*')
        .eq('id', assessmentId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ReadinessAssessment | null;
    },
  });

  // A disabled query (missing assessmentId) has isLoading === false in
  // react-query v5, so this must come before the spinner branch.
  if (!assessmentId || isError || (!isLoading && !assessment)) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center px-8 gap-4">
        <Text className="text-4xl">😕</Text>
        <Body className="text-text-secondary text-center">
          Não foi possível carregar o resultado da medição.
        </Body>
        <Button title="Voltar ao início" size="lg" onPress={() => router.replace('/(tabs)')} />
      </View>
    );
  }

  if (isLoading || !assessment) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center">
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  const colorHex = READINESS_COLOR_HEX[assessment.readiness_color];
  const showFalseReadinessBanner = assessment.false_readiness_flag === true;
  const showLutealBadge = assessment.cycle_phase === 'luteal';
  const showSOPAlert =
    assessment.hormonal_profile === 'sop' && assessment.readiness_color === 'green';

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <H2>Resultado de hoje</H2>
          <ReadinessBadge
            color={assessment.readiness_color}
            label={DIRECTIVE_LABEL[assessment.training_directive]}
          />
        </View>

        {/* Contextual alert banners */}
        {showFalseReadinessBanner && (
          <View className="bg-yellow-500/15 border border-yellow-500/40 rounded-2xl px-4 py-3">
            <Text className="text-yellow-400 font-semibold text-sm">
              ⚠ Modo de conservação energética detectado
            </Text>
            <Text className="text-yellow-300/80 text-xs mt-1">
              Sua VFC está alta, mas sua disposição está baixa — possível downregulation metabólica. Priorize recuperação.
            </Text>
          </View>
        )}

        {showLutealBadge && (
          <View className="bg-purple-500/15 border border-purple-500/40 rounded-2xl px-4 py-3 flex-row items-center gap-2">
            <Text className="text-purple-400 font-semibold text-sm">Fase Lútea — Ajuste aplicado</Text>
            <Caption className="text-purple-300/70 text-xs">
              Correção lútea (+15%) aplicada à VFC para evitar falso alerta de fadiga.
            </Caption>
          </View>
        )}

        {showSOPAlert && (
          <View className="bg-orange-500/15 border border-orange-500/40 rounded-2xl px-4 py-3">
            <Text className="text-orange-400 font-semibold text-sm">
              Perfil SOP — HIIT recomendado
            </Text>
            <Text className="text-orange-300/80 text-xs mt-1">
              Alta intensidade neste dia melhora a sensibilidade à insulina e regulação hormonal.
            </Text>
          </View>
        )}

        {/* Score ring */}
        <Card className="items-center gap-4 py-6">
          <ReadinessRing score={assessment.readiness_score} color={assessment.readiness_color} />
          <View className="items-center gap-1">
            <H3 style={{ color: colorHex }}>{assessment.prescription_text.split('.')[0]}</H3>
          </View>
        </Card>

        {/* Prescription */}
        <Card className="gap-4">
          <Label>Prescrição de treino</Label>
          {isPremium ? (
            <>
              <Body>{assessment.prescription_text}</Body>
              <View className="bg-bg-secondary rounded-2xl p-4 gap-2">
                <Text className="text-text-secondary text-xs font-semibold uppercase tracking-widest">
                  Sessão sugerida
                </Text>
                <Body className="font-medium">{assessment.example_session}</Body>
              </View>
            </>
          ) : (
            <>
              <Body className="text-text-secondary">
                {assessment.prescription_text.split('.')[0]}.
              </Body>
              {/* Locked teaser: never render the real session for free users
                  (CSS blur is a no-op on native and the text stays legible) */}
              <View className="bg-bg-secondary rounded-2xl p-4 gap-2 items-center py-6">
                <Text className="text-2xl">🔒</Text>
                <Text className="text-text-secondary text-sm text-center">
                  Sessão sugerida disponível no Premium
                </Text>
              </View>
              <Button
                title="Desbloquear prescrição completa"
                variant="secondary"
                onPress={() => router.push('/subscription')}
              />
            </>
          )}
        </Card>

        {/* V2 score markers */}
        <Card className="gap-3">
          <Label>Marcadores captados</Label>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-text-primary font-bold text-xl">
                {assessment.s_vfc != null ? Math.round(assessment.s_vfc) : '--'}
              </Text>
              <Caption className="text-center text-xs">S_VFC</Caption>
            </View>
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-text-primary font-bold text-xl">
                {assessment.s_fcr != null ? Math.round(assessment.s_fcr) : '--'}
              </Text>
              <Caption className="text-center text-xs">S_FCR</Caption>
            </View>
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-text-primary font-bold text-xl">
                {assessment.e_wb != null ? Math.round(assessment.e_wb) : '--'}
              </Text>
              <Caption className="text-center text-xs">E_WB</Caption>
            </View>
          </View>
        </Card>

        {/* Behavior log */}
        <Card className="gap-3">
          <BehaviorPicker onSave={saveBehaviors} />
        </Card>

        <Button
          title="Registrar treino de hoje"
          variant="secondary"
          onPress={() => router.push('/measurement/log-session')}
        />

        <Button
          title="Ir para o início"
          size="lg"
          onPress={() => router.replace('/(tabs)')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
