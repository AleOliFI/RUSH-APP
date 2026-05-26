import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/stores/auth';
import { useSubscriptionStore } from '../../src/stores/subscription';
import { useSignOut } from '../../src/hooks/useAuth';
import { useHRVBaseline } from '../../src/hooks/useHRVBaseline';
import { restorePurchases } from '../../src/lib/revenuecat';

export default function ProfileScreen() {
  const { profile } = useAuthStore();
  const { tier } = useSubscriptionStore();
  const { readingCount, baseline7d } = useHRVBaseline();
  const signOut = useSignOut();
  const [restoring, setRestoring] = useState(false);

  async function handleRestorePurchases() {
    setRestoring(true);
    const restored = await restorePurchases();
    setRestoring(false);
    Alert.alert(
      restored ? 'Assinatura restaurada!' : 'Nenhuma compra encontrada',
      restored ? 'Seu Premium está ativo.' : 'Nenhuma compra anterior foi encontrada.',
    );
  }

  const LEVEL_LABELS = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
  };

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

        {/* Stats */}
        <Card className="gap-4">
          <Label>Suas estatísticas</Label>
          <View className="flex-row gap-4">
            <View className="flex-1 bg-bg-secondary rounded-2xl p-4 gap-1 items-center">
              <Text className="text-brand-green text-2xl font-bold">{readingCount}</Text>
              <Caption className="text-center">medições realizadas</Caption>
            </View>
            <View className="flex-1 bg-bg-secondary rounded-2xl p-4 gap-1 items-center">
              <Text className="text-brand-green text-2xl font-bold">
                {baseline7d > 0 ? Math.round(baseline7d) : '--'}
              </Text>
              <Caption className="text-center">VFC baseline (ms)</Caption>
            </View>
          </View>
        </Card>

        {/* Subscription */}
        {tier === 'free' && (
          <Card className="gap-3 border border-brand-green/20">
            <View className="gap-1">
              <Text className="text-text-primary font-semibold text-base">RUSH Premium</Text>
              <Body className="text-text-secondary text-sm">
                Prescrição completa, 28 dias de histórico e integrações com Strava e
                Apple Health.
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
