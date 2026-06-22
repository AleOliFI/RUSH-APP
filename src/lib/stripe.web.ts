import { supabase } from './supabase';
import type { SubscriptionTier } from '../types/subscription';

export const STRIPE_PRICE_MONTHLY = process.env.EXPO_PUBLIC_STRIPE_PRICE_MONTHLY ?? '';
export const STRIPE_PRICE_ANNUAL = process.env.EXPO_PUBLIC_STRIPE_PRICE_ANNUAL ?? '';
export type StripePlan = 'monthly' | 'annual';

export async function presentStripePaymentSheet(
  _plan: StripePlan,
  _userId: string,
): Promise<'success' | 'cancelled'> {
  return 'cancelled';
}

export async function refreshSubscriptionFromSupabase(
  userId: string,
  _retries = 3,
  _delayMs = 2000,
): Promise<SubscriptionTier> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', userId)
    .single();

  if (data?.subscription_tier === 'premium') {
    if (data.subscription_expires_at) {
      const exp = new Date(data.subscription_expires_at);
      if (exp < new Date()) return 'free';
    }
    return 'premium';
  }
  return 'free';
}
