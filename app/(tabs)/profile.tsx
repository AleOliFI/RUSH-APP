import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/stores/auth';
import { useSubscriptionStore } from '../../src/stores/subscription';
import { useSignOut } from '../../src/hooks/useAuth';
import { useHRVBaseline } from '../../src/hooks/useHRVBaseline';
import { useIsPremium } from '../../src/hooks/useSubscription';
import { restorePurchases } from '../../src/lib/revenuecat';
import { supabase } from '../../src/lib/supabase';
import { estimateCyclePhase } from '../../src/lib/algorithms/hormonal';
import { parseDateOnly } from '../../src/lib/dates';
import type { CycleLog, HormonalProfile } from '../../src/types/hrv';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

const HORMONAL_LABELS: Record<string, string> = {
  regular: 'Ciclo regular',
  sop: 'SOP / Ciclo irregular',
  ahf_reds: 'Amenorreia / RED-S',
};

const CYCLE_PHASE_LABELS: Record<string, string> = {
  menstrual: 'Fase Menstrual',
  follicular: 'Fase Folicular',
  luteal: 'Fase Lútea',
  unknown: 'Fase desconhecida',
};

const CYCLE_PHASE_COLORS: Record<string, string> = {
  menstrual: 'text-red-400',
  follicular: 'text-brand-green',
  luteal: 'text-purple-400',
  unknown: 'text-text-secondary',
};

export default function ProfileScreen() {
  const { profile, user } = useAuthStore();
  const { tier, setTier } = useSubscriptionStore();
  const { readingCount, baseline7d, mu28SVC, sigma28SVC } = useHRVBaseline();
  const isPremium = useIsPremium();
  const signOut = useSignOut();
  const [restoring, setRestoring] = useState(false);

  // Fetch hormonal profile + cycle data
  const { data: hormonalData } = useQuery({
    queryKey: ['hormonal-profile', user?.id],
    enabled: !!user && profile?.gender === 'female',
    queryFn: async () => {
      const [{ data: profileData }, { data: cycleLog }] = await Promise.all([
        supabase
          .from('profiles')
          .select('hormonal_profile')
          .eq('id', user!.id)
          .single(),
        supabase
          .from('cycle_logs')
          .select('*')
          .eq('user_id', user!.id)
          .order('cycle_start_date', { ascending: false })
          .limit(1)
          .single(),
      ]);
      const hormonalProfile = profileData?.hormonal_profile as HormonalProfile ?? null;
      let dayOfCycle: number | null = null;
      let cyclePhase = null;
      if (cycleLog) {
        const cl = cycleLog as CycleLog;
        dayOfCycle = Math.floor((Date.now() - parseDateOnly(cl.cycle_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        cyclePhase = estimateCyclePhase(dayOfCycle);
      }
      return { hormonalProfile, dayOfCycle, cyclePhase };
    },
  });

  async function handleRestorePurchases() {
    setRestoring(true);
    const restored = await restorePurchases();
    setRestoring(false);
    if (restored) setTier('premium');
    Alert.alert(
      restored ? 'Assinatura restaurada!' : 'Nenhuma compra encontrada',
      restored ? 'Seu Premium está ativo.' : 'Nenhuma compra anterior foi encontrada.',
    );
  }

  const isFemale = profile?.gender === 'female';
  const cyclePhase = hormonalData?.cyclePhase;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <H2>Perfil</H2>

        {/* User info */}
        <Card className="gap-3">
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 bg-brand-green/20 rounded-full items-center justify-center">
              <Text className="text-brand-green text-xl font-bold">
                {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-text-primary font-semibold text-lg">
                {profile?.full_name ?? 'Atleta'}
              </Text>
              {profile?.runner_level && (
                <Caption>{LEVEL_LABELS[profile.runner_level]}</Caption>
              )}
              {profile?.gender && (
                <Caption className="text-text-muted capitalize">
                  {profile.gender === 'female' ? 'Feminino' : profile.gender === 'male' ? 'Masculino' : 'Outro'}
                </Caption>
              )}
            </View>
            {tier === 'premium' ? (
              <View className="bg-brand-green px-3 py-1 rounded-full">
                <Text className="text-bg-primary text-xs font-bold">PREMIUM</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/subscription')}
                className="bg-brand-green/10 border border-brand-green/30 px-3 py-1 rounded-full"
              >
                <Text className="text-brand-green text-xs font-semibold">Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Cycle & Hormonal info — female only */}
        {isFemale && hormonalData && (
          <Card className="gap-4">
            <Label>Módulo Hormonal</Label>
            <View className="flex-row gap-3">
              {hormonalData.hormonalProfile && (
                <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
                  <Text className="text-purple-400 text-lg">⚡</Text>
                  <Text className="text-text-primary font-semibold text-xs text-center">
                    {HORMONAL_LABELS[hormonalData.hormonalProfile]}
                  </Text>
                  <Caption className="text-xs text-center">Perfil hormonal</Caption>
                </View>
              )}
              {cyclePhase && hormonalData.dayOfCycle && (
                <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
                  <Text className={`font-bold text-base ${CYCLE_PHASE_COLORS[cyclePhase]}`}>
                    Dia {hormonalData.dayOfCycle}
                  </Text>
                  <Text className={`text-xs font-semibold text-center ${CYCLE_PHASE_COLORS[cyclePhase]}`}>
                    {CYCLE_PHASE_LABELS[cyclePhase]}
                  </Text>
                  <Caption className="text-xs text-center">Ciclo atual</Caption>
                </View>
              )}
            </View>
            {cyclePhase === 'luteal' && isPremium && (
              <View className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                <Text className="text-purple-400 text-xs font-semibold">
                  Correção lútea ativa (+15% no S_VFC de hoje)
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/onboarding/profile' as any)}
              className="py-1"
            >
              <Caption className="text-brand-green text-xs">Atualizar data do ciclo</Caption>
            </TouchableOpacity>
          </Card>
        )}

        {/* V2 HRV Stats */}
        <Card className="gap-4">
          <Label>Suas estatísticas</Label>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-brand-green text-2xl font-bold">{readingCount}</Text>
              <Caption className="text-center text-xs">Medições</Caption>
            </View>
            <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
              <Text className="text-brand-green text-2xl font-bold">
                {baseline7d > 0 ? Math.round(baseline7d) : '--'}
              </Text>
              <Caption className="text-center text-xs">VFC baseline ms</Caption>
            </View>
          </View>
          {isPremium && mu28SVC > 0 && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
                <Text className="text-brand-green text-xl font-bold">{Math.round(mu28SVC)}</Text>
                <Caption className="text-center text-xs">µ S_VFC 28d</Caption>
              </View>
              <View className="flex-1 bg-bg-secondary rounded-2xl p-3 gap-1 items-center">
                <Text className="text-text-primary text-xl font-bold">±{Math.round(sigma28SVC)}</Text>
                <Caption className="text-center text-xs">σ variabilidade</Caption>
              </View>
            </View>
          )}
        </Card>

        {/* Wearables */}
        <Card className="gap-3">
          <Label>Integrações</Label>
          <TouchableOpacity
            onPress={() => router.push('/wearables' as any)}
            className="flex-row items-center justify-between py-2"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-xl">🔗</Text>
              <View>
                <Text className="text-text-primary font-semibold text-sm">
                  Garmin / Strava / Apple Health
                </Text>
                <Caption className="text-xs">Importar treinos e TRIMP automaticamente</Caption>
              </View>
            </View>
            <Text className="text-text-muted">›</Text>
          </TouchableOpacity>
        </Card>

        {/* Subscription upsell */}
        {tier === 'free' && (
          <Card className="gap-3 border border-brand-green/20">
            <View className="gap-1">
              <Text className="text-text-primary font-semibold text-base">RUSH Premium</Text>
              <Body className="text-text-secondary text-sm">
                Cérebro Endócrino, downregulation masculina, S_VFC σ-band e 28 dias de histórico.
              </Body>
            </View>
            <Button
              title="Ver planos — a partir de R$19,90/mês"
              onPress={() => router.push('/subscription')}
            />
          </Card>
        )}

        {/* Actions */}
        <View className="gap-3">
          <TouchableOpacity
            onPress={handleRestorePurchases}
            className="py-3 items-center"
            disabled={restoring}
          >
            <Caption className="text-brand-green">
              {restoring ? 'Restaurando...' : 'Restaurar compras'}
            </Caption>
          </TouchableOpacity>
          <Button
            title="Sair"
            variant="ghost"
            onPress={() => {
              Alert.alert('Sair', 'Tem certeza que deseja sair?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: signOut },
              ]);
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
