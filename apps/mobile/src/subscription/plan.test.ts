import { describe, expect, it } from 'vitest';
import { PRODUCT_IDS, planFromEntitlement } from './plan';

describe('planFromEntitlement', () => {
  it('maps store products to monthly and annual', () => {
    expect(planFromEntitlement({ productIdentifier: PRODUCT_IDS.monthly, store: 'APP_STORE' })).toBe('monthly');
    expect(planFromEntitlement({ productIdentifier: PRODUCT_IDS.annual, store: 'PLAY_STORE' })).toBe('annual');
  });

  it('treats RevenueCat promotional grants as complimentary', () => {
    expect(
      planFromEntitlement({ productIdentifier: 'rc_promo_MuscleOS Pro_lifetime', store: 'PROMOTIONAL' })
    ).toBe('complimentary');
    expect(planFromEntitlement({ productIdentifier: 'rc_promo_MuscleOS Pro_monthly', store: 'UNKNOWN_STORE' })).toBe(
      'complimentary'
    );
  });

  it('falls back to monthly for unknown store products', () => {
    expect(planFromEntitlement({ productIdentifier: 'something_else', store: 'APP_STORE' })).toBe('monthly');
  });
});
