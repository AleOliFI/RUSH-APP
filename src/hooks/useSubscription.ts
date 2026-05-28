import { useEffect } from 'react';
import { useSubscriptionStore } from '../stores/subscription';
import { useAuthStore } from '../stores/auth';
import { checkPremiumAccess, identifyUser } from '../lib/revenuecat';
import { refreshSubscriptionFromSupabase } from '../lib/stripe';

/**
 * Syncs subscription status on mount / user change.
 *
 * Priority:
 *  1. RevenueCat (App Store / Play Store native purchases)
 *  2. Stripe via Supabase profile (webhook-confirmed purchases)
 *
 * If RevenueCat says premium → done.
 * Otherwise fall back to the Supabase profile field set by the Stripe webhook.
 */
export function useSubscriptionSync() {
  const { user } = useAuthStore();
  const { setTier, setLoading } = useSubscriptionStore();

  useEffect(() => {
    if (!user) return;

    async function sync() {
      setLoading(true);
      try {
        // 1. Identify user in RevenueCat (no-op in dev without RC keys)
        await identifyUser(user!.id);

        // 2. Check RevenueCat native entitlement first
        const rcPremium = await checkPremiumAccess();
        if (rcPremium) {
          setTier('premium');
          return;
        }

        // 3. Fall back to Stripe tier stored in Supabase (1 attempt, no retry)
        const tier = await refreshSubscriptionFromSupabase(user!.id, 1, 0);
        setTier(tier);
      } finally {
        setLoading(false);
      }
    }

    sync();
  }, [user?.id]);
}

export function useIsPremium() {
  return useSubscriptionStore((s) => s.isPremium);
}
