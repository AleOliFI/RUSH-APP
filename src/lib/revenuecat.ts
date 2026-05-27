import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? '';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '';

export const ENTITLEMENT_PREMIUM = 'premium';
export const OFFERING_DEFAULT = 'default';

export function initRevenueCat() {
  if (Platform.OS === 'web') return;
  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    if (apiKey) {
      Purchases.configure({ apiKey });
    }
  } catch {
    // silently fail in dev without RC keys
  }
}

export async function identifyUser(userId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Purchases.logIn(userId);
  } catch {
    // silently fail in dev without RC keys
  }
}

export async function getOfferings() {
  if (Platform.OS === 'web') return null;
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

export async function checkPremiumAccess(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web: fall back to DB value
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', user.id)
      .single();
    if (!data) return false;
    if (data.subscription_tier !== 'premium') return false;
    if (data.subscription_expires_at) {
      return new Date(data.subscription_expires_at) > new Date();
    }
    return true;
  }
  try {
    const info = await Purchases.getCustomerInfo();
    const isPremium = info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
    // Sync result to Supabase so webhook-less sessions stay consistent
    await syncPremiumToSupabase(isPremium, info);
    return isPremium;
  } catch {
    return false;
  }
}

export async function restorePurchases() {
  if (Platform.OS === 'web') return false;
  try {
    const info = await Purchases.restorePurchases();
    const isPremium = info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
    await syncPremiumToSupabase(isPremium, info);
    return isPremium;
  } catch {
    return false;
  }
}

/** Sync RevenueCat entitlement status to Supabase profiles table. */
async function syncPremiumToSupabase(
  isPremium: boolean,
  customerInfo: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
    const expiresAt = entitlement?.expirationDate ?? null;

    await supabase
      .from('profiles')
      .update({
        subscription_tier: isPremium ? 'premium' : 'free',
        subscription_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  } catch {
    // non-critical — webhook will eventually sync
  }
}
