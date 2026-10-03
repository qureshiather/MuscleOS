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
import { canHoldPro } from '@/subscription/plan';
import {
  BASIC_STATE,
  type CustomerEntitlement,
  cachedStateForPaint,
  isProState,
  resolveSubscriptionState,
} from '@/subscription/state';
import { useAuthStore } from '@/store/authStore';

const BASIC: SubscriptionState = BASIC_STATE;
const LINK_ACCOUNT_MESSAGE = 'Link an account to use Pro.';

function isGuest(): boolean {
  return !canHoldPro(useAuthStore.getState());
}

function stateFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionState {
  const plan = getProPlan(customerInfo);
  return {
    tier: 'pro',
    expiresAt: getProExpirationDate(customerInfo),
    plan,
  };
}

function entitlementFromCustomerInfo(customerInfo: CustomerInfo | null): CustomerEntitlement | null {
  if (!customerInfo) return null;
  if (!hasProEntitlement(customerInfo)) return { active: false };
  return {
    active: true,
    expiresAt: getProExpirationDate(customerInfo),
    plan: getProPlan(customerInfo),
  };
}

/**
 * "Grant Pro (testing)" writes a local override. It only exists in dev builds; release builds
 * ignore it and clear any override left behind by an earlier test build.
 */
async function readDevProOverride(): Promise<boolean> {
  if (__DEV__) return getDevProOverride();
  await setDevProOverride(false);
  return false;
}

/** Ignore stale overlapping load() calls (foreground refresh, screen mount, etc.). */
let loadGeneration = 0;

export interface SubscriptionStoreState {
  state: SubscriptionState | null;
  isLoading: boolean;
  /** Show the cached tier before auth and RevenueCat answer. No-op once anything has set state. */
  hydrate: () => Promise<void>;
  load: (appUserId?: string | null) => Promise<void>;
  setPro: (
    expiresAt?: string,
    options?: { devOverride?: boolean; plan?: SubscriptionPlan }
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

  hydrate: async () => {
    if (get().state) return;
    const stored = await getSubscription();
    if (!stored || get().state) return;
    // Auth hasn't resolved yet, so the guest guard in load() can't run here. load() follows as
    // soon as auth does and corrects the tier; sign-out and account deletion leave a Basic cache.
    set({ state: stored, isLoading: false });
  },

  load: async (appUserId?: string | null) => {
    const generation = ++loadGeneration;

    // Show cached tier immediately so the subscription screen is never stuck on skeleton.
    const stored = await getSubscription();
    if (generation !== loadGeneration) return;
    const cached = cachedStateForPaint({ stored, isGuest: isGuest() });
    // Persist the guest downgrade so hydrate() on the next launch can't flash Pro either.
    if (cached?.tier !== stored?.tier) void setSubscription(BASIC);
    if (cached) {
      set({ state: cached, isLoading: false });
    } else if (!hasRevenueCatApiKey()) {
      await setSubscription(BASIC);
      set({ state: BASIC, isLoading: false });
      return;
    } else {
      set({ isLoading: true });
    }

    try {
      await ensureRevenueCatConfigured(appUserId);
      const devOverride = await getDevProOverride();
      if (generation !== loadGeneration) return;
      const guest = isGuest();
      const needsCustomer = !(__DEV__ && devOverride) && !guest && hasRevenueCatApiKey();
      const customerInfo = needsCustomer ? await getRevenueCatCustomerInfo() : null;
      // Re-read: a purchase / restore may have written a newer state while RevenueCat answered.
      const latest = await getSubscription();
      if (generation !== loadGeneration) return;

      const resolved = resolveSubscriptionState({
        stored: latest,
        isGuest: guest,
        devOverride,
        isDev: __DEV__,
        hasApiKey: hasRevenueCatApiKey(),
        customerInfo: entitlementFromCustomerInfo(customerInfo),
        now: new Date(),
      });
      if (resolved.clearDevOverride) await setDevProOverride(false);
      if (resolved.persist) await setSubscription(resolved.state);
      if (generation !== loadGeneration) return;
      set({ state: resolved.state, isLoading: false });
    } catch {
      if (generation !== loadGeneration) return;
      set({ state: cached ?? BASIC, isLoading: false });
    }
  },

  setPro: async (expiresAt, options) => {
    const state: SubscriptionState = {
      tier: 'pro',
      expiresAt: expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      plan: options?.plan ?? 'annual',
    };
    await setSubscription(state);
    await setDevProOverride(__DEV__ && options?.devOverride === true);
    set({ state, isLoading: false });
  },

  setBasic: async () => {
    const state: SubscriptionState = { tier: 'basic' };
    await setSubscription(state);
    await setDevProOverride(false);
    set({ state, isLoading: false });
  },

  isPro: () => isProState(get().state, new Date()),

  purchasePackage: async (pkg) => {
    if (isGuest()) return { success: false, error: LINK_ACCOUNT_MESSAGE };
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
    const devOverride = await readDevProOverride();
    if (devOverride) {
      await get().load();
      return { success: true, restored: true };
    }
    if (isGuest()) return { success: false, error: LINK_ACCOUNT_MESSAGE };
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
