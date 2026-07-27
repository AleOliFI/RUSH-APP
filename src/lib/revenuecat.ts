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
    // DB sync happens server-side via the RevenueCat webhook; billing columns
    // are read-only for users (migration 011).
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}

export async function restorePurchases() {
  if (Platform.OS === 'web') return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}
