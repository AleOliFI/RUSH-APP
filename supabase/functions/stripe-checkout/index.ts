/**
 * Supabase Edge Function — stripe-checkout
 *
 * Called by the mobile app to create a Stripe Subscription session.
 * Returns the PaymentSheet secrets needed by @stripe/stripe-react-native.
 *
 * Supabase secrets required:
 *   STRIPE_SECRET_KEY          — your Stripe secret key (sk_live_... / sk_test_...)
 *   SUPABASE_URL               — injected automatically
 *   SUPABASE_SERVICE_ROLE_KEY  — injected automatically
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { priceId, userId } = await req.json() as { priceId: string; userId: string };

    if (!priceId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing priceId or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Look up or create the Stripe Customer for this user ──────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, stripe_customer_id')
      .eq('id', userId)
      .single();

    let customerId: string = profile?.stripe_customer_id ?? '';

    if (!customerId) {
      // Get user email from Supabase Auth
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email ?? undefined;

      const customer = await stripe.customers.create({
        email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      // Persist so we reuse the same customer on future purchases
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // ── Create Ephemeral Key (for Payment Sheet) ──────────────────────────────
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-06-20' },
    );

    // ── Create Subscription (incomplete) → exposes PaymentIntent ─────────────
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { supabase_user_id: userId },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to get PaymentIntent client_secret from subscription');
    }

    return new Response(
      JSON.stringify({
        paymentIntentClientSecret: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customerId,
        subscriptionId: subscription.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[stripe-checkout]', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
