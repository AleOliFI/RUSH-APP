import { useEffect } from 'react';
import { useSubscriptionStore } from '../stores/subscription';
import { useAuthStore } from '../stores/auth';
import { checkPremiumAccess, identifyUser } from '../lib/revenuecat';

export function useSubscriptionSync() {
  const { user } = useAuthStore();
  const { setTier, setLoading } = useSubscriptionStore();

  useEffect(() => {
    if (!user) return;

    async function sync() {
      setLoading(true);
      await identifyUser(user!.id);
      const isPremium = await checkPremiumAccess();
      setTier(isPremium ? 'premium' : 'free');
      setLoading(false);
    }

    sync();
  }, [user?.id]);
}

export function useIsPremium() {
  return useSubscriptionStore((s) => s.isPremium);
}
