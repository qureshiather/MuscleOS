import { describe, expect, it } from 'vitest';
import { PRODUCT_IDS, isLifetimeExpiry, planFromEntitlement } from './plan';

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

describe('isLifetimeExpiry', () => {
  const now = new Date('2026-09-30T00:00:00Z');

  it('treats RevenueCat lifetime grants (~200 years out) as lifetime', () => {
    expect(isLifetimeExpiry('2226-08-13T00:09:50Z', now)).toBe(true);
  });

  it('keeps normal and fixed-length expiries as dates', () => {
    expect(isLifetimeExpiry('2027-09-30T00:00:00Z', now)).toBe(false);
    expect(isLifetimeExpiry('2036-09-30T00:00:00Z', now)).toBe(false);
  });

  it('is false for a missing or unparseable date', () => {
    expect(isLifetimeExpiry(undefined, now)).toBe(false);
    expect(isLifetimeExpiry('not a date', now)).toBe(false);
  });
});
