/** USD list prices — must match App Store / Play consoles and docs/monetization/pricing.md */
export const SUBSCRIPTION_PRICING_USD = {
  monthly: 2.99,
  annual: 19.99,
  lifetime: 39.99,
} as const;

export const FALLBACK_PRICE_LABELS = {
  monthly: '$2.99/mo',
  annual: '$19.99/yr',
  lifetime: '$39.99 once',
} as const;

/** Approximate annual savings vs paying monthly for 12 months. */
export function annualSavingsPercent(): number {
  const monthly = SUBSCRIPTION_PRICING_USD.monthly;
  const annual = SUBSCRIPTION_PRICING_USD.annual;
  if (monthly <= 0) return 0;
  return Math.round((1 - annual / (monthly * 12)) * 100);
}
