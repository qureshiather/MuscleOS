import { create } from 'zustand';
import type { SubscriptionState } from '@muscleos/types';
import { getSubscription, setSubscription } from '@/storage/localStorage';

export interface SubscriptionStoreState {
  state: SubscriptionState | null;
  isLoading: boolean;
  load: () => Promise<void>;
  setPro: (expiresAt?: string) => Promise<void>;
  setFree: () => Promise<void>;
  isPro: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  state: null,
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const state = await getSubscription();
    set({ state: state ?? { tier: 'free' }, isLoading: false });
  },

  setPro: async (expiresAt) => {
    const state: SubscriptionState = {
      tier: 'pro',
      expiresAt,
      purchaseToken: undefined,
    };
    await setSubscription(state);
    set({ state });
  },

  setFree: async () => {
    const state: SubscriptionState = { tier: 'free' };
    await setSubscription(state);
    set({ state });
  },

  isPro: () => {
    const { state } = get();
    if (!state || state.tier !== 'pro') return false;
    if (state.expiresAt && new Date(state.expiresAt) < new Date()) return false;
    return true;
  },
}));
