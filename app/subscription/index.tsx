import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { H2, H3, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useSubscriptionStore } from '../../src/stores/subscription';
import { checkPremiumAccess, ENTITLEMENT_PREMIUM } from '../../src/lib/revenuecat';

const PREMIUM_FEATURES = [
  { icon: '🧠', text: 'Cérebro Endócrino: módulo hormonal SOP/AHF-RED-S com correção lútea' },
  { icon: '⚡', text: 'Detecção de downregulation masculina (falsa prontidão)' },
  { icon: '📊', text: 'Histórico 28 dias + curva S_VFC com banda µ±σ' },
  { icon: '🎯', text: 'Prescrição detalhada de sessão (série, pace, duração)' },
  { icon: '📈', text: 'Médias móveis µ_VFC7/28 e estimativa T:C (TRIMP)' },
  { icon: '🔗', text: 'Integração Strava, Apple Health e Garmin' },
];

const PLANS = [
  {
    id: 'annual',
    label: 'Anual',
    price: 'R$ 119,90',
    perMonth: 'R$ 9,99/mês',
    badge: 'Melhor custo-benefício',
    highlight: true,
  },
  {
    id: 'monthly',
    label: 'Mensal',
    price: 'R$ 19,90',
    perMonth: 'por mês',
    badge: null,
    highlight: false,
  },
];

export default function SubscriptionScreen() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string>('annual');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { setTier } = useSubscriptionStore();
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!isWeb) loadOfferings();
    else setFetching(false);
  }, []);

  async function loadOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages) {
        setPackages(offerings.current.availablePackages);
      }
    } catch {
      // no-op in dev without RC keys
    } finally {
      setFetching(false);
    }
  }

  async function handlePurchase() {
    if (isWeb) {
      Alert.alert(
        'Assinatura disponível no app',
        'Baixe o app RUSH no iOS ou Android para se inscrever via App Store ou Google Play.',
      );
      return;
    }

    const pkg = packages.find((p) =>
      selectedPkg === 'annual' ? p.packageType === 'ANNUAL' : p.packageType === 'MONTHLY',
    );

    if (!pkg) {
      Alert.alert(
        'Modo de desenvolvimento',
        'Em produção, este botão abrirá o checkout da App Store/Play Store.',
      );
      return;
    }

    setLoading(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium = customerInfo.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
      if (isPremium) {
        setTier('premium');
        // Sync to DB immediately — don't wait for webhook
        const isPremiumConfirmed = await checkPremiumAccess();
        if (isPremiumConfirmed) setTier('premium');
        Alert.alert('Bem-vindo ao Premium! 🎉', 'Todos os recursos estão desbloqueados.', [
          { text: 'Começar', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Erro', 'Não foi possível processar a compra. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Close */}
        <TouchableOpacity onPress={() => router.back()} className="self-end">
          <Text className="text-text-secondary text-xl">✕</Text>
        </TouchableOpacity>

        <View className="items-center gap-2">
          <Text className="text-brand-green text-3xl font-black tracking-tighter">RUSH</Text>
          <H2 className="text-center">Desbloqueie seu treinador completo</H2>
          <Body className="text-text-secondary text-center">
            O preço de uma inscrição de corrida para ter um treinador de recuperação o ano inteiro.
          </Body>
        </View>

        {/* Features */}
        <Card className="gap-3">
          <Label>Tudo no Premium</Label>
          {PREMIUM_FEATURES.map((f) => (
            <View key={f.text} className="flex-row gap-3 items-start">
              <Text className="text-lg">{f.icon}</Text>
              <Body className="flex-1 text-sm">{f.text}</Body>
            </View>
          ))}
        </Card>

        {/* Web notice */}
        {isWeb && (
          <Card className="bg-bg-card border border-brand-green/20 gap-3 items-center py-5">
            <Text className="text-3xl">📱</Text>
            <H3 className="text-center">Disponível no app móvel</H3>
            <Body className="text-text-secondary text-center text-sm">
              A assinatura é processada pela App Store (iOS) ou Google Play (Android). Baixe o app
              para se inscrever.
            </Body>
            <View className="flex-row gap-3 mt-1">
              <View className="flex-1 bg-bg-secondary rounded-2xl p-3 items-center gap-1">
                <Text className="text-xl">🍎</Text>
                <Caption className="text-xs text-center">App Store</Caption>
              </View>
              <View className="flex-1 bg-bg-secondary rounded-2xl p-3 items-center gap-1">
                <Text className="text-xl">🤖</Text>
                <Caption className="text-xs text-center">Google Play</Caption>
              </View>
            </View>
          </Card>
        )}

        {/* Plans — mobile only */}
        {!isWeb && (
          <>
            <View className="gap-3">
              <Label>Escolha seu plano</Label>
              {fetching ? (
                <View className="items-center py-4">
                  <ActivityIndicator color="#22C55E" />
                </View>
              ) : (
                PLANS.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    onPress={() => setSelectedPkg(plan.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      className={`rounded-3xl p-5 border flex-row items-center justify-between ${
                        selectedPkg === plan.id
                          ? 'bg-brand-green/10 border-brand-green'
                          : 'bg-bg-card border-bg-border'
                      }`}
                    >
                      <View className="gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text
                            className={`font-semibold text-base ${
                              selectedPkg === plan.id ? 'text-brand-green' : 'text-text-primary'
                            }`}
                          >
                            {plan.label}
                          </Text>
                          {plan.badge && (
                            <View className="bg-brand-green px-2 py-0.5 rounded-full">
                              <Text className="text-bg-primary text-xs font-bold">{plan.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Caption>{plan.perMonth}</Caption>
                      </View>
                      <Text
                        className={`text-xl font-bold ${
                          selectedPkg === plan.id ? 'text-brand-green' : 'text-text-primary'
                        }`}
                      >
                        {plan.price}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Anchoring comparison */}
            <View className="bg-bg-card/50 rounded-2xl p-4">
              <Caption className="text-center text-text-muted">
                Comparado ao mercado: Strava Premium R$149,90/ano • Athlytic R$199,90/ano
              </Caption>
            </View>

            <Button
              title={loading ? 'Processando...' : 'Assinar agora'}
              size="lg"
              loading={loading}
              onPress={handlePurchase}
            />

            <Caption className="text-center text-text-muted">
              Cancele quando quiser. Sem compromisso.{'\n'}
              Assinatura gerenciada pela App Store / Play Store.
            </Caption>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
