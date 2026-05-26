import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ReadinessBadge } from '../../src/components/ui/Badge';
import { HRVTrendChart } from '../../src/components/charts/HRVTrendChart';
import { useReadinessHistory } from '../../src/hooks/useReadiness';
import { useIsPremium } from '../../src/hooks/useSubscription';
import { DIRECTIVE_LABEL } from '../../src/lib/algorithms/readiness';

export default function HistoryScreen() {
  const isPremium = useIsPremium();
  const days = isPremium ? 28 : 7;
  const { data: assessments = [], isLoading } = useReadinessHistory(days);

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

        {/* Chart */}
        {assessments.length > 1 && (
          <Card className="gap-3">
            <Label>Escore de prontidão — {days} dias</Label>
            <HRVTrendChart assessments={assessments} />
          </Card>
        )}

        {/* Premium gate */}
        {!isPremium && (
          <Card className="bg-bg-card border border-bg-border gap-3 items-center py-6">
            <Text className="text-3xl">🔒</Text>
            <View className="items-center gap-1">
              <Text className="text-text-primary font-semibold text-base">
                Tendências de 28 dias
              </Text>
              <Body className="text-text-secondary text-center text-sm">
                Identifique fadiga crônica e evoluções de condicionamento com o histórico
                completo.
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
                  {new Date(a.assessed_at).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
                <Caption>{a.prescription_text.split('.')[0]}</Caption>
              </View>
              <View className="items-end gap-1">
                <Text className="text-text-primary font-bold text-lg">
                  {Math.round(a.readiness_score)}
                </Text>
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
