export type SubscriptionTier = 'basic' | 'pro';

export type SubscriptionPlan = 'monthly' | 'annual' | 'lifetime' | null;

export interface SubscriptionState {
  tier: SubscriptionTier;
  /** For pro subscriptions: expiry as ISO string. Omitted for lifetime. */
  expiresAt?: string;
  /** Active billing plan when tier is pro. */
  plan?: SubscriptionPlan;
  /** True when the user purchased lifetime access. */
  isLifetime?: boolean;
  /** Store purchase token for restore */
  purchaseToken?: string;
}
