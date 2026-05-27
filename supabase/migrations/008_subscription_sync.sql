-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Allow service role (used by revenuecat-webhook Edge Function) to update
-- subscription fields without being blocked by RLS.
-- The service role bypasses RLS by default — this comment documents intent.
-- No additional policy needed.

-- Index to speed up subscription expiry queries
CREATE INDEX IF NOT EXISTS profiles_subscription_tier_idx
  ON public.profiles (subscription_tier)
  WHERE subscription_tier = 'premium';
