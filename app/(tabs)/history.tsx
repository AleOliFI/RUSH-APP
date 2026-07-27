import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ReadinessBadge } from '../../src/components/ui/Badge';
import { HRVTrendChart } from '../../src/components/charts/HRVTrendChart';
import { SVFCTrendChart } from '../../src/components/charts/SVFCTrendChart';
import { useReadinessHistory } from '../../src/hooks/useReadiness';
import { useIsPremium } from '../../src/hooks/useSubscription';
import { useHRVBaseline } from '../../src/hooks/useHRVBaseline';
import { DIRECTIVE_LABEL } from '../../src/lib/algorithms/readiness';
import { parseDateOnly } from '../../src/lib/dates';

export default function HistoryScreen() {
  const isPremium = useIsPremium();
  const days = isPremium ? 28 : 7;
  const { data: assessments = [], isLoading } = useReadinessHistory(days);
  const { mu28SVC, sigma28SVC, readingCount } = useHRVBaseline();

  // assessments that have s_vfc recorded (after V2 migration)
  const svcAssessments = assessments.filter((a) => a.s_vfc != null);
  const hasSVCData = isPremium && svcAssessments.length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <H2>Histórico</H2>
          {!isPremium && (
            <TouchableOpacity
              onPress={() => router.push('/subscription')}
              className="bg-brand-green/10 border border-brand-green/30 px-3 py-1.5 rounded-xl"
            >
              <Text className="text-brand-green text-xs font-semibold">
                28 dias → Premium
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* S_VFC trend with σ-band — Premium */}
        {hasSVCData && (
          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Label>S_VFC — {days} dias</Label>
              <View className="flex-row items-center gap-1.5">
                <View className="w-3 h-3 rounded-sm bg-brand-green/20 border border-brand-green/40" />
                <Caption className="text-xs">Zona verde (µ±σ)</Caption>
              </View>
            </View>
            <SVFCTrendChart
              assessments={svcAssessments}
              mu28SVC={mu28SVC}
              sigma28SVC={sigma28SVC}
            />
            {/* Summary stats */}
            <View className="flex-row gap-3 mt-1">
              <View className="flex-1 bg-bg-secondary rounded-xl p-3 gap-0.5 items-center">
                <Text className="text-text-primary font-bold text-base">
                  {mu28SVC > 0 ? Math.round(mu28SVC) : '--'}
                </Text>
                <Caption className="text-xs text-center">µ S_VFC 28d</Caption>
              </View>
              <View className="flex-1 bg-bg-secondary rounded-xl p-3 gap-0.5 items-center">
                <Text className="text-text-primary font-bold text-base">
                  {sigma28SVC > 0 ? `±${Math.round(sigma28SVC)}` : '--'}
                </Text>
                <Caption className="text-xs text-center">σ (variabilidade)</Caption>
              </View>
              <View className="flex-1 bg-bg-secondary rounded-xl p-3 gap-0.5 items-center">
                <Text className="text-text-primary font-bold text-base">{readingCount}</Text>
                <Caption className="text-xs text-center">Leituras total</Caption>
              </View>
            </View>
          </Card>
        )}

        {/* Readiness score chart */}
        {assessments.length > 1 && (
          <Card className="gap-3">
            <Label>Escore de prontidão — {days} dias</Label>
            <HRVTrendChart assessments={assessments} />
          </Card>
        )}

        {/* Premium gate for 28d history */}
        {!isPremium && (
          <Card className="bg-bg-card border border-bg-border gap-3 items-center py-6">
            <Text className="text-3xl">🔒</Text>
            <View className="items-center gap-1">
              <Text className="text-text-primary font-semibold text-base">
                Tendências de 28 dias + S_VFC
              </Text>
              <Body className="text-text-secondary text-center text-sm">
                Veja sua curva de VFC linearizada com a banda de normalidade µ±σ para identificar
                fadiga crônica antes que vire lesão.
              </Body>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/subscription')}
              className="bg-brand-green rounded-2xl px-6 py-3"
            >
              <Text className="text-bg-primary font-semibold">Ver planos</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Day list */}
        <View className="gap-3">
          <Label>Avaliações recentes</Label>
          {assessments.map((a) => (
            <Card key={a.id} className="flex-row items-center gap-4">
              <View className="flex-1 gap-1">
                <Text className="text-text-primary font-semibold">
                  {parseDateOnly(a.assessed_at).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
                <Caption>{a.prescription_text.split('.')[0]}</Caption>
              </View>
              <View className="items-end gap-1">
                <View className="flex-row items-center gap-2">
                  {a.s_vfc != null && (
                    <View className="bg-bg-secondary rounded-xl px-2 py-1">
                      <Text className="text-text-secondary text-xs">
                        S_VFC {Math.round(a.s_vfc)}
                      </Text>
                    </View>
                  )}
                  <Text className="text-text-primary font-bold text-lg">
                    {Math.round(a.readiness_score)}
                  </Text>
                </View>
                <ReadinessBadge
                  color={a.readiness_color}
                  label={DIRECTIVE_LABEL[a.training_directive]}
                />
              </View>
            </Card>
          ))}

          {assessments.length === 0 && !isLoading && (
            <View className="items-center py-10 gap-2">
              <Text className="text-4xl">📊</Text>
              <Body className="text-text-secondary text-center">
                Nenhum dado ainda. Faça sua primeira medição!
              </Body>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
