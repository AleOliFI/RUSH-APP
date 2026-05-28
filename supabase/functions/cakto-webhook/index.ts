/**
 * Supabase Edge Function — Cakto Webhook Handler
 *
 * Register this URL in your Cakto dashboard under:
 *   Settings → Webhooks → URL: https://<project>.supabase.co/functions/v1/cakto-webhook
 *
 * Set the secret in Supabase dashboard:
 *   Project → Edge Functions → Secrets → CAKTO_API_KEY = <your key>
 *
 * Events handled:
 *   - payment.approved  → activates premium
 *   - subscription.cancelled / payment.refunded → reverts to free
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CAKTO_API_KEY      = Deno.env.get('CAKTO_API_KEY') ?? '';
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Cakto premium plan durations (in days)
const PLAN_DURATION: Record<string, number> = {
  monthly: 31,
  annual:  366,
};

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // ── Verify Cakto signature ─────────────────────────────────────────────────
  const signature = req.headers.get('x-cakto-signature') ?? '';
  if (!signature || !CAKTO_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Verify: Cakto sends the API key as the signature header value
  if (signature !== CAKTO_API_KEY) {
    console.error('[cakto-webhook] Invalid signature');
    return new Response('Forbidden', { status: 403 });
  }

  // ── Extract event data ─────────────────────────────────────────────────────
  const event    = (payload.event as string) ?? '';
  const data     = (payload.data as Record<string, unknown>) ?? {};
  const userId   = (data.ref as string) ?? (data.customer_ref as string) ?? '';
  const planSlug = ((data.offer_slug ?? data.plan_slug ?? 'monthly') as string).toLowerCase();

  if (!userId) {
    console.error('[cakto-webhook] Missing user ref in payload', payload);
    return new Response('Missing ref', { status: 422 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Handle events ──────────────────────────────────────────────────────────
  if (event === 'payment.approved' || event === 'subscription.activated') {
    const durationDays = PLAN_DURATION[planSlug] ?? PLAN_DURATION.monthly;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier:       'premium',
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[cakto-webhook] Supabase update error:', error.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    console.log(`[cakto-webhook] ✓ Premium activated for user=${userId} until=${expiresAt.toISOString()}`);
  } else if (
    event === 'subscription.cancelled' ||
    event === 'payment.refunded'       ||
    event === 'subscription.expired'
  ) {
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier:       'free',
        subscription_expires_at: null,
      })
      .eq('id', userId);

    if (error) {
      console.error('[cakto-webhook] Supabase update error:', error.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    console.log(`[cakto-webhook] ✓ Subscription reverted to free for user=${userId}`);
  } else {
    // Acknowledge unhandled events silently
    console.log(`[cakto-webhook] Ignored event: ${event}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
