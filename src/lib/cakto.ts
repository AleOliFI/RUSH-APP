/**
 * Cakto payment integration
 *
 * Architecture:
 *  - Checkout happens via Cakto's hosted page opened in the system browser.
 *  - The API key lives exclusively in the Supabase Edge Function (server-side).
 *    It is NEVER exposed in the mobile bundle.
 *  - After payment, Cakto calls our webhook → Supabase updates the user profile.
 *  - The app polls Supabase after returning from the browser to reflect the new tier.
 */

import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import type { SubscriptionTier } from '../types/subscription';

// ── Checkout URLs ────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_CAKTO_CHECKOUT_MONTHLY and _ANNUAL in your .env to the
// Cakto offer links generated in the Cakto dashboard.
const CHECKOUT_MONTHLY =
  process.env.EXPO_PUBLIC_CAKTO_CHECKOUT_MONTHLY ?? 'https://pay.cakto.com.br/rush-mensal';
const CHECKOUT_ANNUAL =
  process.env.EXPO_PUBLIC_CAKTO_CHECKOUT_ANNUAL ?? 'https://pay.cakto.com.br/rush-anual';

export type CaktoPlan = 'monthly' | 'annual';

/**
 * Opens the Cakto hosted checkout in the system browser.
 * The `userId` is appended as a query param so the webhook can identify the buyer.
 *
 * Returns `true` if the browser session closed cleanly (user may have paid),
 * or `false` if the user cancelled early.
 */
export async function openCaktoCheckout(
  plan: CaktoPlan,
  userId: string,
): Promise<boolean> {
  const base = plan === 'annual' ? CHECKOUT_ANNUAL : CHECKOUT_MONTHLY;
  const url  = `${base}?ref=${encodeURIComponent(userId)}`;

  const result = await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    showTitle: true,
    toolbarColor: '#0f0f0f',
    secondaryToolbarColor: '#e72329',
    enableBarCollapsing: false,
  });

  // CANCEL = user explicitly dismissed; anything else = may have completed
  return result.type !== 'cancel';
}

/**
 * Re-fetches the user's subscription tier from Supabase.
 * Call this right after `openCaktoCheckout` returns so the UI reflects the
 * payment the webhook may have already processed.
 */
export async function refreshSubscriptionFromSupabase(
  userId: string,
): Promise<SubscriptionTier> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', userId)
    .single();

  if (error || !data) return 'free';

  // Treat expired subscriptions as free
  if (data.subscription_expires_at) {
    const expiresAt = new Date(data.subscription_expires_at);
    if (expiresAt < new Date()) return 'free';
  }

  return (data.subscription_tier as SubscriptionTier) ?? 'free';
}
