import { create } from 'zustand';
import type { SubscriptionTier } from '../types/subscription';

interface SubscriptionState {
  tier: SubscriptionTier;
  isPremium: boolean;
  isLoading: boolean;
  setTier: (tier: SubscriptionTier) => void;
  setLoading: (loading: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'free',
  isPremium: false,
  isLoading: false,
  setTier: (tier) => set({ tier, isPremium: tier === 'premium' }),
  setLoading: (isLoading) => set({ isLoading }),
}));
