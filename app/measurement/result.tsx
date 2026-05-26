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
import type { ReadinessAssessment } from '../../src/types/readiness';

export default function ResultScreen() {
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();
  const isPremium = useIsPremium();

  const { data: assessment, isLoading } = useQuery({
    queryKey: ['assessment', assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('readiness_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();
      return data as ReadinessAssessment;
    },
  });

  if (isLoading || !assessment) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center">
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  const colorHex = READINESS_COLOR_HEX[assessment.readiness_color];

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
              <View
                className="bg-bg-secondary rounded-2xl p-4 gap-2 opacity-40"
                style={{ filter: 'blur(4px)' as any }}
              >
                <Text className="text-text-secondary text-xs font-semibold uppercase tracking-widest">
                  Sessão sugerida
                </Text>
                <Body>{assessment.example_session}</Body>
              </View>
              <Button
                title="Desbloquear prescrição completa"
                variant="secondary"
                onPress={() => router.push('/subscription')}
              />
            </>
          )}
        </Card>

        {/* Markers */}
        <Card className="gap-3">
          <Label>Marcadores captados</Label>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-text-primary font-bold text-xl">
                {assessment.baseline_rmssd_7d
                  ? Math.round(assessment.baseline_rmssd_7d)
                  : '--'}
              </Text>
              <Caption className="text-center text-xs">VFC baseline 7d (ms)</Caption>
            </View>
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-text-primary font-bold text-xl">
                {assessment.cv_7d ? `${Math.round(assessment.cv_7d)}%` : '--'}
              </Text>
              <Caption className="text-center text-xs">CV 7d</Caption>
            </View>
          </View>
        </Card>

        <Button
          title="Ir para o início"
          size="lg"
          onPress={() => router.replace('/(tabs)')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
