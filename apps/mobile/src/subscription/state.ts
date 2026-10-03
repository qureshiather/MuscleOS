import type { SubscriptionPlan, SubscriptionState } from '@muscleos/types';

export const BASIC_STATE: SubscriptionState = { tier: 'basic' };

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Pro is active when the tier is `pro` and any expiry is still in the future. */
export function isProState(state: SubscriptionState | null | undefined, now: Date): boolean {
  if (!state || state.tier !== 'pro') return false;
  if (state.expiresAt && new Date(state.expiresAt).getTime() < now.getTime()) return false;
  return true;
}

/** A stored tier as read from disk: the legacy value `free` (or anything unknown) reads as Basic. */
export type StoredSubscription = Omit<SubscriptionState, 'tier'> & { tier?: string };

export function normalizeStoredSubscription(
  stored: StoredSubscription | null | undefined
): SubscriptionState | null {
  if (!stored) return null;
  return { ...stored, tier: stored.tier === 'pro' ? 'pro' : 'basic' };
}

/**
 * The tier to paint from cache before RevenueCat answers. A Pro cache left by a linked account must
 * not flash Pro for the guest that replaced it.
 */
export function cachedStateForPaint(args: {
  stored: StoredSubscription | null | undefined;
  isGuest: boolean;
}): SubscriptionState | null {
  const stored = normalizeStoredSubscription(args.stored);
  if (stored?.tier === 'pro' && args.isGuest) return BASIC_STATE;
  return stored;
}

/** The parts of a RevenueCat customer the tier needs; `null` means the read failed or timed out. */
export type CustomerEntitlement =
  | { active: false }
  | { active: true; expiresAt?: string; plan: SubscriptionPlan };

export interface ResolvedSubscription {
  state: SubscriptionState;
  /** Write `state` to the `muscleos_subscription` cache. */
  persist: boolean;
  /** Clear a dev "Grant Pro (testing)" override left behind (release builds only). */
  clearDevOverride: boolean;
}

/**
 * The tier `subscriptionStore.load()` settles on once RevenueCat has been asked. In order:
 *
 * 1. A dev build's "Grant Pro (testing)" override wins — over guests too (the one exception). It
 *    keeps a cached Pro state, otherwise Pro (annual) for a year from `now`.
 * 2. A release build ignores the override and asks for it to be cleared.
 * 3. A guest is always Basic (`canHoldPro`), even if RevenueCat reports the entitlement.
 * 4. No RevenueCat API key for the platform → Basic.
 * 5. A failed / timed-out customer read keeps the cached state (a cached Pro user is never
 *    downgraded by a flaky network) and doesn't overwrite the cache.
 * 6. Otherwise the entitlement decides: Pro with its expiry and plan, or Basic.
 */
export function resolveSubscriptionState(args: {
  stored: StoredSubscription | null | undefined;
  isGuest: boolean;
  devOverride: boolean;
  isDev: boolean;
  hasApiKey: boolean;
  customerInfo: CustomerEntitlement | null;
  now: Date;
}): ResolvedSubscription {
  const stored = normalizeStoredSubscription(args.stored);
  const clearDevOverride = !args.isDev && args.devOverride;

  if (args.isDev && args.devOverride) {
    const state: SubscriptionState =
      stored?.tier === 'pro'
        ? stored
        : {
            tier: 'pro',
            expiresAt: new Date(args.now.getTime() + YEAR_MS).toISOString(),
            plan: 'annual',
          };
    return { state, persist: false, clearDevOverride: false };
  }
  if (args.isGuest || !args.hasApiKey) {
    return { state: BASIC_STATE, persist: true, clearDevOverride };
  }
  if (args.customerInfo == null) {
    return { state: stored ?? BASIC_STATE, persist: false, clearDevOverride };
  }
  if (args.customerInfo.active) {
    return {
      state: {
        tier: 'pro',
        expiresAt: args.customerInfo.expiresAt,
        plan: args.customerInfo.plan,
      },
      persist: true,
      clearDevOverride,
    };
  }
  return { state: BASIC_STATE, persist: true, clearDevOverride };
}
