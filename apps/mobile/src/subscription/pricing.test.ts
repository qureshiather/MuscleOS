import { describe, expect, it } from 'vitest';
import { FALLBACK_PRICE_LABELS, SUBSCRIPTION_PRICING_USD, annualSavingsPercent } from './pricing';

describe('pricing', () => {
  it('lists $2.99/mo and $19.99/yr', () => {
    expect(SUBSCRIPTION_PRICING_USD).toEqual({ monthly: 2.99, annual: 19.99 });
    expect(FALLBACK_PRICE_LABELS).toEqual({ monthly: '$2.99/mo', annual: '$19.99/yr' });
  });

  it('computes annual savings against 12 monthly payments', () => {
    // 1 − 19.99 / 35.88 ≈ 44%
    expect(annualSavingsPercent()).toBe(44);
  });
});
