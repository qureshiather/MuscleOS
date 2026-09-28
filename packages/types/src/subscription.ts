export type SubscriptionTier = 'basic' | 'pro';

/** `complimentary` = a promotional entitlement granted from RevenueCat, not a store purchase. */
export type SubscriptionPlan = 'monthly' | 'annual' | 'complimentary' | null;

export interface SubscriptionState {
  tier: SubscriptionTier;
  /** For pro subscriptions: expiry as ISO string. */
  expiresAt?: string;
  /** Active billing plan when tier is pro. */
  plan?: SubscriptionPlan;
  /** Store purchase token for restore */
  purchaseToken?: string;
}
