import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth';
import { useTodayReadiness, useReadinessHistory } from '../../src/hooks/useReadiness';
import { ReadinessRing } from '../../src/components/charts/ReadinessRing';
import { HRVTrendChart } from '../../src/components/charts/HRVTrendChart';
import { ReadinessBadge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { H2, H3, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { DIRECTIVE_LABEL } from '../../src/lib/algorithms/readiness';
import { useHRVBaseline } from '../../src/hooks/useHRVBaseline';
import { useIsPremium } from '../../src/hooks/useSubscription';

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const { data: today, isLoading } = useTodayReadiness();
  const { data: history = [] } = useReadinessHistory(7);
  const { readingCount } = useHRVBaseline();
  const isPremium = useIsPremium();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Atleta';
  const greeting = getGreeting();

  const showFalseReadinessBanner = today?.false_readiness_flag === true;
  const showLutealBadge = today?.cycle_phase === 'luteal' && isPremium;
  const hasV2Scores = today?.s_vfc != null;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Caption>{greeting}</Caption>
            <H2>{firstName}</H2>
          </View>
          <Text className="text-brand-green text-2xl font-black tracking-tighter">RUSH</Text>
        </View>

        {/* Contextual alert banners */}
        {showFalseReadinessBanner && (
          <View className="bg-yellow-500/15 border border-yellow-500/40 rounded-2xl px-4 py-3">
            <Text className="text-yellow-400 font-semibold text-sm">
              ⚠ Modo de conservação energética
            </Text>
            <Text className="text-yellow-300/80 text-xs mt-1">
              VFC alta com disposição baixa — possível downregulation metabólica. Priorize recuperação hoje.
            </Text>
          </View>
        )}

        {showLutealBadge && (
          <View className="bg-purple-500/15 border border-purple-500/40 rounded-2xl px-4 py-3 flex-row items-center gap-2">
            <Text className="text-purple-400 font-semibold text-sm">
              Fase Lútea — Ajuste aplicado
            </Text>
          </View>
        )}

        {/* Today's Readiness Card */}
        {isLoading ? (
          <Card className="items-center py-10">
            <ActivityIndicator color="#22C55E" />
          </Card>
        ) : today ? (
          <Card className="gap-5">
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <Label>Prontidão de hoje</Label>
                <H3>{today.prescription_text.split('.')[0]}</H3>
              </View>
              <ReadinessBadge
                color={today.readiness_color}
                label={DIRECTIVE_LABEL[today.training_directive]}
              />
            </View>

            <View className="items-center">
              <ReadinessRing score={today.readiness_score} color={today.readiness_color} />
            </View>

            {/* V2 component scores */}
            {hasV2Scores && (
              <View className="flex-row gap-2">
                <View className="flex-1 bg-bg-secondary rounded-xl p-2.5 items-center gap-0.5">
                  <Text className="text-text-primary font-bold text-sm">
                    {Math.round(today.s_vfc!)}
                  </Text>
                  <Caption className="text-xs">S_VFC</Caption>
                </View>
                <View className="flex-1 bg-bg-secondary rounded-xl p-2.5 items-center gap-0.5">
                  <Text className="text-text-primary font-bold text-sm">
                    {Math.round(today.s_fcr!)}
                  </Text>
                  <Caption className="text-xs">S_FCR</Caption>
                </View>
                <View className="flex-1 bg-bg-secondary rounded-xl p-2.5 items-center gap-0.5">
                  <Text className="text-text-primary font-bold text-sm">
                    {Math.round(today.e_wb!)}
                  </Text>
                  <Caption className="text-xs">E_WB</Caption>
                </View>
              </View>
            )}

            <View className="bg-bg-secondary rounded-2xl p-4 gap-1.5">
              <Label>Treino sugerido</Label>
              <Body className="text-sm">{today.example_session}</Body>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/measurement/log-session')}
              className="flex-row items-center justify-center gap-1.5 py-2"
            >
              <Text className="text-brand-green text-xs font-semibold">+ Registrar treino de hoje</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <Card className="gap-4 items-center py-6">
            <Text className="text-5xl">💚</Text>
            <View className="items-center gap-1">
              <H3>Faça sua medição de hoje</H3>
              <Body className="text-text-secondary text-center">
                120 segundos com o dedo na câmera (60s estabilização + 60s captura) para descobrir
                sua prescrição do dia.
              </Body>
            </View>
            <Button
              title="Medir agora"
              size="lg"
              onPress={() => router.push('/measurement/camera')}
              className="w-full"
            />
          </Card>
        )}

        {/* Calibration progress */}
        {readingCount < 7 && (
          <Card className="bg-brand-green/5 border border-brand-green/20 gap-2">
            <View className="flex-row items-center justify-between">
              <Label className="text-brand-green">Calibração</Label>
              <Caption>{readingCount}/7 leituras</Caption>
            </View>
            <View className="bg-bg-border rounded-full h-2">
              <View
                className="bg-brand-green rounded-full h-2"
                style={{ width: `${(readingCount / 7) * 100}%` }}
              />
            </View>
            <Caption>
              Sua baseline de VFC estará pronta em {7 - readingCount} medições.
            </Caption>
          </Card>
        )}

        {/* 7-day trend */}
        {history.length > 0 && (
          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Label>Tendência 7 dias</Label>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Caption className="text-brand-green">Ver tudo</Caption>
              </TouchableOpacity>
            </View>
            <HRVTrendChart assessments={history} />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia,';
  if (hour < 18) return 'Boa tarde,';
  return 'Boa noite,';
}
