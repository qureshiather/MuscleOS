import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN,
  PLAN_LABELS,
  PURCHASABLE_PLANS,
  annualSavingsFromPrices,
  currentPlanLines,
  planPriceLabel,
  planSubtitle,
  purchaseButtonState,
} from './paywall';

const now = new Date('2026-06-01T00:00:00Z');

describe('plan selection and labels', () => {
  it('offers monthly and annual, with annual pre-selected', () => {
    expect(PURCHASABLE_PLANS).toEqual(['monthly', 'annual']);
    expect(DEFAULT_PLAN).toBe('annual');
    expect(PLAN_LABELS).toEqual({ monthly: 'Monthly', annual: 'Annual', complimentary: 'Complimentary' });
  });

  it('appends the period to the store price', () => {
    expect(planPriceLabel('monthly', '€3,49')).toBe('€3,49/mo');
    expect(planPriceLabel('annual', '£19.99')).toBe('£19.99/yr');
  });

  it('falls back to the USD list price when the package has not loaded', () => {
    expect(planPriceLabel('monthly', undefined)).toBe('$2.99/mo');
    expect(planPriceLabel('annual', null)).toBe('$19.99/yr');
    expect(planPriceLabel('annual', '')).toBe('$19.99/yr');
  });
});

describe('annual savings', () => {
  it('computes from store prices when both loaded', () => {
    expect(annualSavingsFromPrices(5, 30)).toBe(50);
  });
  it('falls back to the USD list prices (44%) when a price is missing or annual is not cheaper', () => {
    expect(annualSavingsFromPrices(undefined, 30)).toBe(44);
    expect(annualSavingsFromPrices(2, undefined)).toBe(44);
    expect(annualSavingsFromPrices(1, 20)).toBe(44);
    expect(annualSavingsFromPrices(0, 20)).toBe(44);
  });
  it('shows the saving only under annual', () => {
    expect(planSubtitle('annual', 44)).toBe('Save 44% vs monthly');
    expect(planSubtitle('monthly', 44)).toBeNull();
  });
});

describe('currentPlanLines', () => {
  it('Basic: tier only, no manage', () => {
    expect(currentPlanLines({ tier: 'basic' }, now)).toEqual({
      tierLabel: 'Basic',
      planLabel: null,
      expiry: null,
      showManage: false,
    });
    expect(currentPlanLines(null, now).tierLabel).toBe('Basic');
  });

  it('an expired Pro state reads as Basic', () => {
    expect(currentPlanLines({ tier: 'pro', expiresAt: '2026-01-01T00:00:00Z', plan: 'monthly' }, now).tierLabel).toBe(
      'Basic'
    );
  });

  it('store plan: Renews {date} and Manage subscription', () => {
    expect(currentPlanLines({ tier: 'pro', expiresAt: '2027-01-01T00:00:00Z', plan: 'annual' }, now)).toEqual({
      tierLabel: 'Pro',
      planLabel: 'Annual plan',
      expiry: { kind: 'renews', at: '2027-01-01T00:00:00Z' },
      showManage: true,
    });
  });

  it('complimentary fixed-length: Until {date}, Manage hidden', () => {
    expect(
      currentPlanLines({ tier: 'pro', expiresAt: '2026-09-01T00:00:00Z', plan: 'complimentary' }, now)
    ).toEqual({
      tierLabel: 'Pro',
      planLabel: 'Complimentary plan',
      expiry: { kind: 'until', at: '2026-09-01T00:00:00Z' },
      showManage: false,
    });
  });

  it('complimentary lifetime (~200 years out, or no expiry): Lifetime', () => {
    expect(
      currentPlanLines({ tier: 'pro', expiresAt: '2226-01-01T00:00:00Z', plan: 'complimentary' }, now).expiry
    ).toEqual({ kind: 'lifetime' });
    expect(currentPlanLines({ tier: 'pro', plan: 'complimentary' }, now).expiry).toEqual({ kind: 'lifetime' });
  });

  it('store plan with no expiry shows no date line', () => {
    expect(currentPlanLines({ tier: 'pro', plan: 'monthly' }, now)).toMatchObject({
      planLabel: 'Monthly plan',
      expiry: null,
      showManage: true,
    });
  });
});

describe('purchaseButtonState', () => {
  const base = { isAnonymous: false, hasApiKey: true, offersLoading: false, purchasing: false, selectedPlan: 'annual' as const };

  it('Continue with the selected plan when ready', () => {
    expect(purchaseButtonState(base)).toEqual({ kind: 'continue', label: 'Continue with Annual', disabled: false });
    expect(purchaseButtonState({ ...base, selectedPlan: 'monthly' }).label).toBe('Continue with Monthly');
  });

  it('keeps the normal copy but disables while RevenueCat configures / plans load', () => {
    expect(purchaseButtonState({ ...base, offersLoading: true })).toEqual({
      kind: 'continue',
      label: 'Continue with Annual',
      disabled: true,
    });
  });

  it('disables while a purchase is in flight', () => {
    expect(purchaseButtonState({ ...base, purchasing: true }).disabled).toBe(true);
  });

  it('Purchases unavailable only without an API key', () => {
    expect(purchaseButtonState({ ...base, hasApiKey: false })).toEqual({
      kind: 'unavailable',
      label: 'Purchases unavailable',
      disabled: true,
    });
  });

  it('a guest gets Link account to purchase instead', () => {
    expect(purchaseButtonState({ ...base, isAnonymous: true, hasApiKey: false })).toEqual({
      kind: 'link-account',
      label: 'Link account to purchase',
      disabled: false,
    });
  });
});
