import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RC_WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN') ?? '';

type RCEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'BILLING_ISSUE'
  | 'EXPIRATION'
  | 'SUBSCRIBER_ALIAS'
  | 'TRANSFER';

interface RCEvent {
  type: RCEventType;
  app_user_id: string;
  aliases?: string[];
  expiration_at_ms: number | null;
  product_id: string;
  period_type: 'NORMAL' | 'TRIAL' | 'INTRO';
}

interface RCWebhookPayload {
  event: RCEvent;
  api_version: string;
}

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Validate RevenueCat webhook auth header — fail closed
  const authHeader = req.headers.get('Authorization');
  if (!RC_WEBHOOK_AUTH) {
    console.error('[RC Webhook] REVENUECAT_WEBHOOK_AUTH_TOKEN not set — rejecting all requests');
    return new Response('Webhook auth not configured', { status: 503 });
  }
  if (authHeader !== RC_WEBHOOK_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: RCWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { event } = payload;
  if (!event?.app_user_id) {
    return new Response('Missing app_user_id', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const userId = event.app_user_id;
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  let tier: 'free' | 'premium' = 'free';
  let subscriptionExpiresAt: string | null = null;

  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      tier = 'premium';
      subscriptionExpiresAt = expiresAt;
      break;

    case 'CANCELLATION':
      // User cancelled but still has access until expiration
      tier = 'premium';
      subscriptionExpiresAt = expiresAt;
      break;

    case 'EXPIRATION':
    case 'BILLING_ISSUE':
      tier = 'free';
      subscriptionExpiresAt = null;
      break;

    default:
      // SUBSCRIBER_ALIAS, TRANSFER — no tier change needed
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_expires_at: subscriptionExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating profile:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[RC Webhook] ${event.type} → user ${userId} → tier=${tier}`);

  return new Response(JSON.stringify({ received: true, tier }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
