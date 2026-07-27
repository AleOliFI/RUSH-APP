import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useIsPremium } from '../../src/hooks/useSubscription';
import { useAuthStore } from '../../src/stores/auth';

const WEARABLES = [
  {
    id: 'garmin',
    name: 'Garmin Connect',
    icon: '⌚',
    desc: 'Importa treinos, TRIMP, VO₂max estimado e variabilidade durante o sono.',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
  {
    id: 'strava',
    name: 'Strava',
    icon: '🟠',
    desc: 'Importa atividades com distância, pace, FC média e TRIMP calculado.',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/5',
  },
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: '❤️',
    desc: 'Importa VFC noturna (HRV4Training), FC de repouso e treinos registrados.',
    color: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    icon: '🤸',
    desc: 'Importa atividades e métricas de saúde do ecossistema Android/Wear OS.',
    color: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
  },
];

export default function WearablesScreen() {
  const isPremium = useIsPremium();
  const { session, isLoading: authLoading } = useAuthStore();

  if (authLoading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <H2>Integrações</H2>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-text-secondary text-base">✕</Text>
          </TouchableOpacity>
        </View>

        <Body className="text-text-secondary">
          Conecte seus wearables para importar treinos automaticamente e alimentar o estimador de
          carga T:C sem precisar registrar manualmente.
        </Body>

        {/* Premium gate */}
        {!isPremium && (
          <View className="bg-brand-green/8 border border-brand-green/20 rounded-2xl px-4 py-4 gap-3">
            <Text className="text-brand-green font-semibold text-sm">
              🔒 Recurso Premium
            </Text>
            <Body className="text-text-secondary text-sm">
              As integrações com wearables fazem parte do plano Premium. Ative para sincronizar
              TRIMP e ter a estimativa T:C alimentada automaticamente.
            </Body>
            <Button
              title="Ver planos"
              variant="secondary"
              onPress={() => router.push('/subscription')}
            />
          </View>
        )}

        {/* Wearable cards */}
        <View className="gap-3">
          <Label>Dispositivos disponíveis</Label>
          {WEARABLES.map((w) => (
            <Card key={w.id} className={`gap-3 ${w.bg} border ${w.border}`}>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">{w.icon}</Text>
                <View className="flex-1">
                  <Text className={`font-semibold text-base ${w.color}`}>{w.name}</Text>
                  <Caption className="text-xs mt-0.5">{w.desc}</Caption>
                </View>
                <View className="bg-bg-secondary px-2 py-1 rounded-full">
                  <Text className="text-text-muted text-xs font-semibold">Em breve</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Manual fallback */}
        <Card className="gap-3">
          <Label>Registro manual</Label>
          <Body className="text-text-secondary text-sm">
            Enquanto as integrações automáticas não estão disponíveis, registre seus treinos
            manualmente após cada medição para alimentar o estimador T:C.
          </Body>
          <Button
            title="Registrar treino agora"
            variant="secondary"
            onPress={() => router.push('/measurement/log-session')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
