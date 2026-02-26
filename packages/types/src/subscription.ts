export type SubscriptionTier = 'free' | 'pro';

export interface SubscriptionState {
  tier: SubscriptionTier;
  /** For pro: expiry as ISO string */
  expiresAt?: string;
  /** Store purchase token for restore */
  purchaseToken?: string;
}
