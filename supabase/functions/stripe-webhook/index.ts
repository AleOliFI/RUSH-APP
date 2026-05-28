/**
 * Supabase Edge Function — stripe-webhook
 *
 * Register this URL in Stripe Dashboard → Developers → Webhooks:
 *   https://<project>.supabase.co/functions/v1/stripe-webhook
 *
 * Events to listen to:
 *   ✅ customer.subscription.updated
 *   ✅ customer.subscription.deleted
 *   ✅ invoice.payment_succeeded
 *   ✅ invoice.payment_failed
 *
 * Supabase secrets required:
 *   STRIPE_SECRET_KEY          — your Stripe secret key
 *   STRIPE_WEBHOOK_SECRET      — whsec_... from Stripe webhook dashboard
 *   SUPABASE_URL               — injected automatically
 *   SUPABASE_SERVICE_ROLE_KEY  — injected automatically
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  console.log(`[stripe-webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      // ── Payment confirmed — activate premium ─────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        await supabase.from('profiles').update({
          subscription_tier:       'premium',
          subscription_expires_at: expiresAt,
          stripe_customer_id:      subscription.customer as string,
        }).eq('id', userId);

        console.log(`[stripe-webhook] ✓ Premium activated: user=${userId} until=${expiresAt}`);
        break;
      }

      // ── Subscription updated (renewal, plan change) ──────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        await supabase.from('profiles').update({
          subscription_tier:       isActive ? 'premium' : 'free',
          subscription_expires_at: isActive ? expiresAt : null,
        }).eq('id', userId);

        console.log(`[stripe-webhook] ✓ Subscription updated: user=${userId} status=${subscription.status}`);
        break;
      }

      // ── Subscription cancelled / expired — revert to free ────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase.from('profiles').update({
          subscription_tier:       'free',
          subscription_expires_at: null,
        }).eq('id', userId);

        console.log(`[stripe-webhook] ✓ Subscription cancelled: user=${userId}`);
        break;
      }

      // ── Payment failed — keep current state, app can notify user ─────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[stripe-webhook] Payment failed for invoice=${invoice.id}`);
        // Stripe retries automatically; we don't revoke access immediately.
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
