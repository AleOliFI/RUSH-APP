import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useSubscriptionStore } from '../../src/stores/subscription';
import { useAuthStore } from '../../src/stores/auth';
import { openCaktoCheckout, refreshSubscriptionFromSupabase } from '../../src/lib/cakto';
import type { CaktoPlan } from '../../src/lib/cakto';

const PREMIUM_FEATURES = [
  { icon: '🎯', text: 'Matriz de Prescrição completa (5 estados)' },
  { icon: '📊', text: 'Histórico de 28 dias + tendências crônicas' },
  { icon: '🔗', text: 'Integração Strava, Apple Health e Garmin' },
  { icon: '💊', text: 'Escore de Bem-Estar cruzado (DOMS + estresse)' },
  { icon: '📈', text: 'Médias móveis 7d e 28d de VFC' },
];

const PLANS = [
  {
    id: 'annual' as CaktoPlan,
    label: 'Anual',
    price: 'R$ 119,90',
    perMonth: 'R$ 9,99/mês',
    badge: 'Melhor custo-benefício',
    highlight: true,
  },
  {
    id: 'monthly' as CaktoPlan,
    label: 'Mensal',
    price: 'R$ 19,90',
    perMonth: 'por mês',
    badge: null,
    highlight: false,
  },
];

export default function SubscriptionScreen() {
  const [packages, setPackages]     = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<CaktoPlan>('annual');
  const [loading, setLoading]       = useState(false);
  const [fetching, setFetching]     = useState(true);
  const { setTier } = useSubscriptionStore();
  const { user }    = useAuthStore();

  useEffect(() => {
    loadNativeOfferings();
  }, []);

  async function loadNativeOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages) {
        setPackages(offerings.current.availablePackages);
      }
    } catch {
      // no-op in dev without RevenueCat keys
    } finally {
      setFetching(false);
    }
  }

  /**
   * Purchase flow:
   *  - On iOS/Android with RevenueCat packages → native IAP (App Store / Play Store)
   *  - Otherwise (web or no RC packages) → Cakto hosted checkout
   */
  async function handlePurchase() {
    setLoading(true);
    try {
      // ── Native IAP path (RevenueCat) ──────────────────────────────────────
      if (Platform.OS !== 'web' && packages.length > 0) {
        const pkg = packages.find((p) =>
          selectedPkg === 'annual'
            ? p.packageType === 'ANNUAL'
            : p.packageType === 'MONTHLY',
        );

        if (pkg) {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
          if (isPremium) {
            setTier('premium');
            router.back();
          }
          return;
        }
      }

      // ── Cakto web checkout path ───────────────────────────────────────────
      if (!user) {
        Alert.alert('Erro', 'Você precisa estar logado para assinar.');
        return;
      }

      const browserClosed = await openCaktoCheckout(selectedPkg, user.id);

      if (browserClosed) {
        // Give the webhook a moment to process, then refresh
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const tier = await refreshSubscriptionFromSupabase(user.id);

        if (tier === 'premium') {
          setTier('premium');
          Alert.alert(
            '🎉 Assinatura ativada!',
            'Bem-vindo ao RUSH Pro. Aproveite todos os recursos.',
            [{ text: 'Continuar', onPress: () => router.back() }],
          );
        } else {
          // Payment may still be processing — user can restart the app
          Alert.alert(
            'Processando pagamento',
            'Se o pagamento foi aprovado, seu acesso será liberado em instantes. '
            + 'Feche e reabra o app se ainda não aparecer.',
          );
        }
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

        {/* Header */}
        <View className="items-center gap-2">
          <Text className="text-rush-red text-3xl font-black tracking-tighter uppercase">
            RUSH
          </Text>
          <H2 className="text-center">Desbloqueie seu treinador completo</H2>
          <Body className="text-text-secondary text-center">
            O preço de uma inscrição de corrida para ter um treinador de recuperação o ano
            inteiro.
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

        {/* Plans */}
        <View className="gap-3">
          <Label>Escolha seu plano</Label>
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPkg(plan.id)}
              activeOpacity={0.8}
            >
              <View
                className={`rounded-2xl p-5 border flex-row items-center justify-between ${
                  selectedPkg === plan.id
                    ? 'bg-rush-red/10 border-rush-red'
                    : 'bg-bg-card border-bg-border'
                }`}
              >
                <View className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`font-bold text-base uppercase tracking-widest ${
                        selectedPkg === plan.id ? 'text-rush-red' : 'text-text-primary'
                      }`}
                    >
                      {plan.label}
                    </Text>
                    {plan.badge && (
                      <View className="bg-rush-lime px-2 py-0.5 rounded-sm">
                        <Text className="text-bg-primary text-xs font-bold uppercase tracking-widest">
                          {plan.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Caption>{plan.perMonth}</Caption>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-xl font-black ${
                      selectedPkg === plan.id ? 'text-rush-red' : 'text-text-primary'
                    }`}
                  >
                    {plan.price}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Anchoring comparison */}
        <View className="bg-bg-card/50 rounded-sm p-4 border border-bg-border gap-1">
          <Caption className="text-center text-text-muted">
            Comparado ao mercado: Strava Premium R$149,90/ano • Athlytic R$199,90/ano
          </Caption>
        </View>

        {/* CTA */}
        {fetching ? (
          <ActivityIndicator color="#e72329" />
        ) : (
          <Button
            title={loading ? 'Processando...' : 'Assinar agora'}
            size="lg"
            loading={loading}
            onPress={handlePurchase}
          />
        )}

        {/* Payment method notice */}
        <View className="items-center gap-1">
          <Caption className="text-center text-text-muted">
            Pagamento seguro via{' '}
            <Text className="text-rush-red font-bold">Cakto</Text>
            {packages.length > 0 ? ' ou App Store / Play Store' : ''}.
          </Caption>
          <Caption className="text-center text-text-muted">
            Cancele quando quiser. Sem compromisso.
          </Caption>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
