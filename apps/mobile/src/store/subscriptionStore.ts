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
  configureRevenueCat,
  getRevenueCatCustomerInfo,
  hasProEntitlement,
  getProExpirationDate,
  getProPlan,
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
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean }>;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  state: null,
  isLoading: true,

  load: async (_appUserId?: string | null) => {
    set({ isLoading: true });
    try {
      configureRevenueCat(_appUserId);
      const devOverride = await getDevProOverride();
      if (devOverride) {
        const state: SubscriptionState = {
          tier: 'pro',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'annual',
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
        const state = stateFromCustomerInfo(customerInfo);
        await setSubscription(state);
        set({ state, isLoading: false });
        return;
      }
      const state: SubscriptionState = { tier: 'basic' };
      await setSubscription(state);
      set({ state, isLoading: false });
    } catch {
      set({ state: { tier: 'basic' }, isLoading: false });
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
    set({ state });
  },

  setBasic: async () => {
    const state: SubscriptionState = { tier: 'basic' };
    await setSubscription(state);
    await setDevProOverride(false);
    set({ state });
  },

  isPro: () => {
    const { state } = get();
    if (!state || state.tier !== 'pro') return false;
    if (state.isLifetime) return true;
    if (state.expiresAt && new Date(state.expiresAt) < new Date()) return false;
    return true;
  },

  purchasePackage: async (pkg) => {
    try {
      const customerInfo = await rcPurchasePackage(pkg);
      if (customerInfo && hasProEntitlement(customerInfo)) {
        const state = stateFromCustomerInfo(customerInfo);
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
        const state = stateFromCustomerInfo(customerInfo);
        await setSubscription(state);
        set({ state });
        return { success: true };
      }
      const state: SubscriptionState = { tier: 'basic' };
      await setSubscription(state);
      set({ state });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
}));
