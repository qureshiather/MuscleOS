import type { SubscriptionPlan } from '@muscleos/types';

/** App Store / Play product identifiers — must match store consoles and RevenueCat. */
export const PRODUCT_IDS = {
  monthly: 'muscleos_pro_monthly',
  annual: 'muscleos_pro_annual',
} as const;

/** The subset of RevenueCat's `EntitlementInfo` needed to tell plans apart. */
export interface EntitlementPlanInfo {
  productIdentifier: string;
  store: string;
}

/**
 * Map an active Pro entitlement to a plan. Promotional entitlements granted from the
 * RevenueCat dashboard (e.g. lifetime Pro for friends) have no store product behind them.
 */
export function planFromEntitlement(ent: EntitlementPlanInfo): NonNullable<SubscriptionPlan> {
  if (ent.store === 'PROMOTIONAL' || ent.productIdentifier.startsWith('rc_promo')) {
    return 'complimentary';
  }
  if (ent.productIdentifier === PRODUCT_IDS.annual) return 'annual';
  return 'monthly';
}
