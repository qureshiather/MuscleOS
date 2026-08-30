import { create } from 'zustand';
import type { CustomerInfo } from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import type { SubscriptionPlan, SubscriptionState } from '@muscleos/types';
import {
  getSubscription,
  setSubscription,
  getDevProOverride,
  setDevProOverride,
} from '@/storage/localStorage';
import {
  ensureRevenueCatConfigured,
  getRevenueCatCustomerInfo,
  hasProEntitlement,
  getProExpirationDate,
  getProPlan,
  hasRevenueCatApiKey,
  purchasePackage as rcPurchasePackage,
  restorePurchases as rcRestorePurchases,
} from '@/utils/revenueCat';

function stateFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionState {
  const plan = getProPlan(customerInfo);
  const isLifetime = plan === 'lifetime';
  const expiresAt = isLifetime ? undefined : getProExpirationDate(customerInfo);
  return {
    tier: 'pro',
    expiresAt,
    plan,
    isLifetime,
  };
}

/** Ignore stale overlapping load() calls (foreground refresh, screen mount, etc.). */
let loadGeneration = 0;

export interface SubscriptionStoreState {
  state: SubscriptionState | null;
  isLoading: boolean;
  load: (appUserId?: string | null) => Promise<void>;
  setPro: (
    expiresAt?: string,
    options?: { devOverride?: boolean; plan?: SubscriptionPlan; isLifetime?: boolean }
  ) => Promise<void>;
  setBasic: () => Promise<void>;
  isPro: () => boolean;
  purchasePackage: (
    pkg: PurchasesPackage
  ) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; restored?: boolean; error?: string }>;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  state: null,
  isLoading: true,

  load: async (_appUserId?: string | null) => {
    const generation = ++loadGeneration;

    // Show cached tier immediately so the subscription screen is never stuck on skeleton.
    const cached = await getSubscription();
    if (generation !== loadGeneration) return;
    if (cached) {
      set({ state: cached, isLoading: false });
    } else if (!hasRevenueCatApiKey()) {
      const state: SubscriptionState = { tier: 'basic' };
      await setSubscription(state);
      set({ state, isLoading: false });
      return;
    } else {
      set({ isLoading: true });
    }

    try {
      await ensureRevenueCatConfigured(_appUserId);
      const devOverride = await getDevProOverride();
      if (generation !== loadGeneration) return;

      if (devOverride) {
        const state: SubscriptionState = {
          tier: 'pro',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'annual',
        };
        const stored = await getSubscription();
        if (generation !== loadGeneration) return;
        set({
          state: stored?.tier === 'pro' ? stored : state,
          isLoading: false,
        });
        return;
      }

      const customerInfo = await getRevenueCatCustomerInfo();
      if (generation !== loadGeneration) return;

      if (customerInfo && hasProEntitlement(customerInfo)) {
        const state = stateFromCustomerInfo(customerInfo);
        await setSubscription(state);
        set({ state, isLoading: false });
        return;
      }

      const state: SubscriptionState = { tier: 'basic' };
      await setSubscription(state);
      set({ state, isLoading: false });
    } catch {
      if (generation !== loadGeneration) return;
      const fallback = cached ?? { tier: 'basic' as const };
      set({ state: fallback, isLoading: false });
    }
  },

  setPro: async (expiresAt, options) => {
    const isLifetime = options?.isLifetime ?? false;
    const state: SubscriptionState = {
      tier: 'pro',
      expiresAt: isLifetime
        ? undefined
        : expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      plan: options?.plan ?? 'annual',
      isLifetime,
    };
    await setSubscription(state);
    if (options?.devOverride) {
      await setDevProOverride(true);
    } else {
      await setDevProOverride(false);
    }
    set({ state, isLoading: false });
  },

  setBasic: async () => {
    const state: SubscriptionState = { tier: 'basic' };
    await setSubscription(state);
    await setDevProOverride(false);
    set({ state, isLoading: false });
  },

  isPro: () => {
    const { state } = get();
    if (!state || state.tier !== 'pro') return false;
    if (state.isLifetime) return true;
    if (state.expiresAt && new Date(state.expiresAt) < new Date()) return false;
    return true;
  },

  purchasePackage: async (pkg) => {
    const result = await rcPurchasePackage(pkg);
    if (result.status === 'cancelled') {
      return { success: false, cancelled: true };
    }
    if (result.status === 'error') {
      return { success: false, error: result.message };
    }
    if (hasProEntitlement(result.customerInfo)) {
      const state = stateFromCustomerInfo(result.customerInfo);
      await setSubscription(state);
      set({ state, isLoading: false });
      return { success: true };
    }
    return {
      success: false,
      error: 'Purchase completed but Pro is not active yet. Try Restore purchases.',
    };
  },

  restorePurchases: async () => {
    const devOverride = await getDevProOverride();
    if (devOverride) {
      await get().load();
      return { success: true, restored: true };
    }
    const result = await rcRestorePurchases();
    if (result.status === 'error') {
      return { success: false, error: result.message };
    }
    if (hasProEntitlement(result.customerInfo)) {
      const state = stateFromCustomerInfo(result.customerInfo);
      await setSubscription(state);
      set({ state, isLoading: false });
      return { success: true, restored: true };
    }
    const state: SubscriptionState = { tier: 'basic' };
    await setSubscription(state);
    set({ state, isLoading: false });
    return { success: true, restored: false };
  },
}));
