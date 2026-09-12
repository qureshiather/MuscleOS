export type SubscriptionTier = 'basic' | 'pro';

export type SubscriptionPlan = 'monthly' | 'annual' | null;

export interface SubscriptionState {
  tier: SubscriptionTier;
  /** For pro subscriptions: expiry as ISO string. */
  expiresAt?: string;
  /** Active billing plan when tier is pro. */
  plan?: SubscriptionPlan;
  /** Store purchase token for restore */
  purchaseToken?: string;
}
