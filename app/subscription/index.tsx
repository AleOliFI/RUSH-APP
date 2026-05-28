import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { H2, Body, Caption, Label } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useSubscriptionStore } from '../../src/stores/subscription';
import { useAuthStore } from '../../src/stores/auth';
import {
  presentStripePaymentSheet,
  refreshSubscriptionFromSupabase,
  type StripePlan,
} from '../../src/lib/stripe';

const PREMIUM_FEATURES = [
  { icon: '🧠', text: 'Cérebro Endócrino: módulo hormonal SOP/AHF-RED-S com correção lútea' },
  { icon: '⚡', text: 'Detecção de downregulation masculina (falsa prontidão)' },
  { icon: '📊', text: 'Histórico 28 dias + curva S_VFC com banda µ±σ' },
  { icon: '🎯', text: 'Prescrição detalhada de sessão (série, pace, duração)' },
  { icon: '📈', text: 'Médias móveis µ_VFC7/28 e estimativa T:C (TRIMP)' },
  { icon: '🔗', text: 'Integração Strava, Apple Health e Garmin' },
];

const PLANS: Array<{
  id: StripePlan;
  label: string;
  price: string;
  perMonth: string;
  badge: string | null;
  highlight: boolean;
}> = [
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
  const [rcPackages, setRcPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StripePlan>('annual');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { setTier } = useSubscriptionStore();
  const { user } = useAuthStore();

  useEffect(() => {
    loadNativeOfferings();
  }, []);

  async function loadNativeOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages) {
        setRcPackages(offerings.current.availablePackages);
      }
    } catch {
      // no-op without RevenueCat keys
    } finally {
      setFetching(false);
    }
  }

  async function handlePurchase() {
    setLoading(true);
    try {
      // ── Native IAP via RevenueCat (App Store / Play Store) ───────────────
      if (Platform.OS !== 'web' && rcPackages.length > 0) {
        const pkg = rcPackages.find((p) =>
          selectedPlan === 'annual'
            ? p.packageType === 'ANNUAL'
            : p.packageType === 'MONTHLY',
        );
        if (pkg) {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          if (customerInfo.entitlements.active['premium']) {
            setTier('premium');
            router.back();
          }
          return;
        }
      }

      // ── Stripe Payment Sheet ──────────────────────────────────────────────
      if (!user) {
        Alert.alert('Erro', 'Você precisa estar logado para assinar.');
        return;
      }

      const result = await presentStripePaymentSheet(selectedPlan, user.id);
      if (result === 'cancelled') return;

      // Poll Supabase until webhook confirms (up to 3×, 2 s apart)
      const tier = await refreshSubscriptionFromSupabase(user.id, 3, 2000);

      if (tier === 'premium') {
        setTier('premium');
        Alert.alert(
          '🎉 Assinatura ativada!',
          'Bem-vindo ao RUSH Pro. Todos os recursos estão desbloqueados.',
          [{ text: 'Continuar', onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          'Processando pagamento',
          'Seu pagamento foi recebido. O acesso será liberado em instantes — feche e reabra o app se precisar.',
        );
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Erro', e.message ?? 'Não foi possível processar a compra. Tente novamente.');
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
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.8}
            >
              <View
                className={`rounded-2xl p-5 border flex-row items-center justify-between ${
                  selectedPlan === plan.id
                    ? 'bg-rush-red/10 border-rush-red'
                    : 'bg-bg-card border-bg-border'
                }`}
              >
                <View className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`font-bold text-base uppercase tracking-widest ${
                        selectedPlan === plan.id ? 'text-rush-red' : 'text-text-primary'
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
                      selectedPlan === plan.id ? 'text-rush-red' : 'text-text-primary'
                    }`}
                  >
                    {plan.price}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Market comparison */}
        <View className="bg-bg-card/50 rounded-sm p-4 border border-bg-border">
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

        {/* Payment footnote */}
        <View className="items-center gap-1">
          <Caption className="text-center text-text-muted">
            Pagamento seguro via{' '}
            <Text className="text-rush-red font-bold">Stripe</Text>
            {rcPackages.length > 0 ? ' ou App Store / Play Store' : ''}.
          </Caption>
          <Caption className="text-center text-text-muted">
            Cancele quando quiser. Sem compromisso.
          </Caption>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
