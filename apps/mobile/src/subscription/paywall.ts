import type { SubscriptionPlan, SubscriptionState } from '@muscleos/types';
import { FALLBACK_PRICE_LABELS, annualSavingsPercent } from '@/subscription/pricing';
import { isLifetimeExpiry } from '@/subscription/plan';
import { isProState } from '@/subscription/state';

export type PlanKey = 'monthly' | 'annual';

export const PURCHASABLE_PLANS: PlanKey[] = ['monthly', 'annual'];

/** Plan pre-selected on the paywall (shown with the "Best value" badge). */
export const DEFAULT_PLAN: PlanKey = 'annual';

export const PLAN_LABELS: Record<NonNullable<SubscriptionPlan>, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  complimentary: 'Complimentary',
};

const PERIOD_SUFFIX: Record<PlanKey, string> = { monthly: '/mo', annual: '/yr' };

/** Store price with the billing period ("$2.99/mo"); the USD fallback when the package hasn't loaded. */
export function planPriceLabel(plan: PlanKey, storePriceString: string | null | undefined): string {
  return storePriceString ? `${storePriceString}${PERIOD_SUFFIX[plan]}` : FALLBACK_PRICE_LABELS[plan];
}

/**
 * "Save N% vs monthly", computed from the store's numeric prices when both packages loaded and the
 * annual plan is actually cheaper; otherwise from the USD list prices.
 */
export function annualSavingsFromPrices(
  monthlyPrice: number | null | undefined,
  annualPrice: number | null | undefined
): number {
  if (monthlyPrice != null && annualPrice != null && monthlyPrice > 0) {
    const pct = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
    if (pct > 0) return pct;
  }
  return annualSavingsPercent();
}

export function planSubtitle(plan: PlanKey, savingsPercent: number): string | null {
  return plan === 'annual' ? `Save ${savingsPercent}% vs monthly` : null;
}

export interface CurrentPlanLines {
  tierLabel: 'Pro' | 'Basic';
  /** "Annual plan", "Complimentary plan", … — Pro only. */
  planLabel: string | null;
  /** Renews {date} (store plan) · Until {date} (complimentary) · Lifetime (complimentary, no or ~200y expiry). */
  expiry: { kind: 'renews' | 'until'; at: string } | { kind: 'lifetime' } | null;
  /** Manage subscription — hidden for complimentary grants (no store subscription behind them). */
  showManage: boolean;
}

/** What the paywall's Current plan card shows. */
export function currentPlanLines(state: SubscriptionState | null, now: Date): CurrentPlanLines {
  const pro = isProState(state, now);
  if (!pro || !state) {
    return { tierLabel: 'Basic', planLabel: null, expiry: null, showManage: false };
  }
  const complimentary = state.plan === 'complimentary';
  const lifetime = isLifetimeExpiry(state.expiresAt, now);
  let expiry: CurrentPlanLines['expiry'] = null;
  if (complimentary && (!state.expiresAt || lifetime)) expiry = { kind: 'lifetime' };
  else if (state.expiresAt && !lifetime) {
    expiry = { kind: complimentary ? 'until' : 'renews', at: state.expiresAt };
  }
  return {
    tierLabel: 'Pro',
    planLabel: state.plan ? `${PLAN_LABELS[state.plan]} plan` : null,
    expiry,
    showManage: !complimentary,
  };
}

export interface PurchaseButtonState {
  kind: 'continue' | 'link-account' | 'unavailable';
  label: string;
  disabled: boolean;
}

/**
 * The paywall's primary button. A guest sees "Link account to purchase" (purchases need a linked
 * account). "Purchases unavailable" only when there's no RevenueCat API key for the platform; while
 * RevenueCat is still configuring / loading plans the button keeps its normal copy but is disabled.
 */
export function purchaseButtonState(args: {
  isAnonymous: boolean;
  hasApiKey: boolean;
  offersLoading: boolean;
  purchasing: boolean;
  selectedPlan: PlanKey;
}): PurchaseButtonState {
  if (args.isAnonymous) {
    return { kind: 'link-account', label: 'Link account to purchase', disabled: false };
  }
  if (!args.hasApiKey) {
    return { kind: 'unavailable', label: 'Purchases unavailable', disabled: true };
  }
  return {
    kind: 'continue',
    label: `Continue with ${PLAN_LABELS[args.selectedPlan]}`,
    disabled: args.offersLoading || args.purchasing,
  };
}
