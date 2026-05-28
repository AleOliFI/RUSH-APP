-- Migration 009: Add stripe_customer_id to profiles
-- Required by the stripe-checkout Edge Function to persist
-- the Stripe Customer ID alongside the user profile.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Optional index for reverse-lookup (webhook uses supabase_user_id metadata,
-- but having this index available speeds up future customer-portal flows).
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
