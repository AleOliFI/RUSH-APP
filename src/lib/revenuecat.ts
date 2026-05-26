import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? '';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '';

export const ENTITLEMENT_PREMIUM = 'premium';

export const OFFERING_DEFAULT = 'default';

export function initRevenueCat() {
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (apiKey) {
    Purchases.configure({ apiKey });
  }
}

export async function identifyUser(userId: string) {
  try {
    await Purchases.logIn(userId);
  } catch {
    // silently fail in dev without RC keys
  }
}

export async function getOfferings() {
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

export async function checkPremiumAccess(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}

export async function restorePurchases() {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}
