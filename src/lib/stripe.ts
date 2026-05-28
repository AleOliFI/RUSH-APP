/**
 * Stripe payment integration — RUSH APP
 *
 * Architecture:
 *  ┌─ Mobile App ──────────────────────────────────────────────────────────┐
 *  │  1. calls Supabase Edge Function `stripe-checkout`                    │
 *  │  2. receives { clientSecret, customerId }                              │
 *  │  3. presents Stripe Payment Sheet (native SDK)                        │
 *  │  4. on success → re-reads subscription tier from Supabase             │
 *  └───────────────────────────────────────────────────────────────────────┘
 *  ┌─ Supabase Edge Functions ─────────────────────────────────────────────┐
 *  │  stripe-checkout  → creates Customer + Subscription, returns secret   │
 *  │  stripe-webhook   → confirms payment, sets subscription_tier=premium  │
 *  └───────────────────────────────────────────────────────────────────────┘
 *
 * Stripe keys are NEVER in the mobile bundle except the publishable key.
 * Secret key and webhook secret live exclusively as Supabase secrets.
 */

import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { supabase } from './supabase';
import type { SubscriptionTier } from '../types/subscription';

// ── Price IDs created in Stripe dashboard ────────────────────────────────────
export const STRIPE_PRICE_MONTHLY =
  process.env.EXPO_PUBLIC_STRIPE_PRICE_MONTHLY ?? 'price_1Tc50t3wVAAUEXFEmXmbJr3C';

export const STRIPE_PRICE_ANNUAL =
  process.env.EXPO_PUBLIC_STRIPE_PRICE_ANNUAL ?? 'price_1Tc50u3wVAAUEXFE96kZBV49';

export type StripePlan = 'monthly' | 'annual';

// ── Step 1 — request a PaymentSheet session from our Edge Function ─────────

interface CheckoutSession {
  paymentIntentClientSecret: string;
  setupIntentClientSecret?: string;
  ephemeralKey: string;
  customerId: string;
}

async function createCheckoutSession(
  plan: StripePlan,
  userId: string,
): Promise<CheckoutSession> {
  const priceId = plan === 'annual' ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;

  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { priceId, userId },
  });

  if (error) throw new Error(`stripe-checkout: ${error.message}`);
  if (!data?.paymentIntentClientSecret) {
    throw new Error('stripe-checkout returned incomplete session');
  }

  return data as CheckoutSession;
}

// ── Step 2 — present the native Stripe Payment Sheet ─────────────────────

/**
 * Full checkout flow:
 *  - Creates a subscription session via Supabase Edge Function
 *  - Initialises and presents the Stripe Payment Sheet
 *  - Returns `'success'`, `'cancelled'`, or throws on error
 */
export async function presentStripePaymentSheet(
  plan: StripePlan,
  userId: string,
): Promise<'success' | 'cancelled'> {
  const session = await createCheckoutSession(plan, userId);

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'RUSH Performance',
    customerId: session.customerId,
    customerEphemeralKeySecret: session.ephemeralKey,
    paymentIntentClientSecret: session.paymentIntentClientSecret,
    // Appearance matching Rush Performance design system
    appearance: {
      colors: {
        primary: '#e72329',
        background: '#0f0f0f',
        componentBackground: '#1a1a1a',
        componentBorder: '#2e2e2e',
        componentDivider: '#2e2e2e',
        primaryText: '#f7f5f3',
        secondaryText: '#9e9b94',
        componentText: '#f7f5f3',
        placeholderText: '#3a3a3a',
        icon: '#9e9b94',
        error: '#e72329',
      },
      shapes: { borderRadius: 4, borderWidth: 1 },
    },
    allowsDelayedPaymentMethods: false,
    returnURL: 'rushapp://stripe-return',
  });

  if (initError) throw new Error(`initPaymentSheet: ${initError.message}`);

  const { error: presentError } = await presentPaymentSheet();

  if (presentError) {
    if (presentError.code === 'Canceled') return 'cancelled';
    throw new Error(`presentPaymentSheet: ${presentError.message}`);
  }

  return 'success';
}

// ── Step 3 — re-read subscription status from Supabase ────────────────────

/**
 * Polls Supabase for the current subscription tier.
 * Call right after `presentStripePaymentSheet` returns 'success'.
 * The webhook may take a few seconds; retry up to 3×.
 */
export async function refreshSubscriptionFromSupabase(
  userId: string,
  retries = 3,
  delayMs = 2000,
): Promise<SubscriptionTier> {
  for (let i = 0; i < retries; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .single();

    if (data?.subscription_tier === 'premium') {
      // Check expiry
      if (data.subscription_expires_at) {
        const exp = new Date(data.subscription_expires_at);
        if (exp < new Date()) return 'free';
      }
      return 'premium';
    }

    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return 'free';
}
