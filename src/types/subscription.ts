export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  expires_at: string | null;
  is_active: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  gender: 'male' | 'female' | 'other' | null;
  date_of_birth: string | null;
  weekly_mileage_km: number | null;
  runner_level: 'beginner' | 'intermediate' | 'advanced' | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
}
