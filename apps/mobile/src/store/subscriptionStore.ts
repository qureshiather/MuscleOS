import { create } from 'zustand';
import type { SubscriptionState } from '@muscleos/types';
import {
  getSubscription,
  setSubscription,
  getDevProOverride,
  setDevProOverride,
} from '@/storage/localStorage';
import {
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  hasProEntitlement,
  getProExpirationDate,
  purchasePro,
  restorePurchases as rcRestorePurchases,
} from '@/utils/revenueCat';

export interface SubscriptionStoreState {
  state: SubscriptionState | null;
  isLoading: boolean;
  load: () => Promise<void>;
  setPro: (expiresAt?: string, options?: { devOverride?: boolean }) => Promise<void>;
  setFree: () => Promise<void>;
  isPro: () => boolean;
  purchasePro: () => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean }>;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  state: null,
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    try {
      configureRevenueCat();
      const devOverride = await getDevProOverride();
      if (devOverride) {
        const state: SubscriptionState = {
          tier: 'pro',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        const stored = await getSubscription();
        set({
          state: stored?.tier === 'pro' ? stored : state,
          isLoading: false,
        });
        return;
      }
      const customerInfo = await getRevenueCatCustomerInfo();
      if (customerInfo && hasProEntitlement(customerInfo)) {
        const expiresAt = getProExpirationDate(customerInfo);
        const state: SubscriptionState = { tier: 'pro', expiresAt };
        await setSubscription(state);
        set({ state, isLoading: false });
        return;
      }
      const state: SubscriptionState = { tier: 'free' };
      await setSubscription(state);
      set({ state, isLoading: false });
    } catch {
      set({ state: { tier: 'free' }, isLoading: false });
    }
  },

  setPro: async (expiresAt, options) => {
    const state: SubscriptionState = {
      tier: 'pro',
      expiresAt: expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      purchaseToken: undefined,
    };
    await setSubscription(state);
    if (options?.devOverride) {
      await setDevProOverride(true);
    } else {
      await setDevProOverride(false);
    }
    set({ state });
  },

  setFree: async () => {
    const state: SubscriptionState = { tier: 'free' };
    await setSubscription(state);
    await setDevProOverride(false);
    set({ state });
  },

  isPro: () => {
    const { state } = get();
    if (!state || state.tier !== 'pro') return false;
    if (state.expiresAt && new Date(state.expiresAt) < new Date()) return false;
    return true;
  },

  purchasePro: async () => {
    try {
      const customerInfo = await purchasePro();
      if (customerInfo && hasProEntitlement(customerInfo)) {
        const expiresAt = getProExpirationDate(customerInfo);
        const state: SubscriptionState = { tier: 'pro', expiresAt };
        await setSubscription(state);
        set({ state });
        return { success: true };
      }
      return { success: false, error: 'Purchase did not grant Pro.' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Purchase failed';
      return { success: false, error: message };
    }
  },

  restorePurchases: async () => {
    const devOverride = await getDevProOverride();
    if (devOverride) {
      await get().load();
      return { success: true };
    }
    try {
      const customerInfo = await rcRestorePurchases();
      if (customerInfo && hasProEntitlement(customerInfo)) {
        const expiresAt = getProExpirationDate(customerInfo);
        const state: SubscriptionState = { tier: 'pro', expiresAt };
        await setSubscription(state);
        set({ state });
        return { success: true };
      }
      const state: SubscriptionState = { tier: 'free' };
      await setSubscription(state);
      set({ state });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
}));
