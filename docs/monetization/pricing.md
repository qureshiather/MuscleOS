# Pricing

MuscleOS Pro is priced in the **budget fitness app** band: a few dollars, not a premium subscription.

What Pro actually unlocks: [features/subscriptions.md](../features/subscriptions.md).

## Plans (USD)

| Plan | Price | Effective monthly | Notes |
|------|-------|-------------------|-------|
| **Pro Monthly** | **$2.99/mo** | $2.99 | Entry anchor |
| **Pro Annual** | **$19.99/yr** | ~$1.67/mo | **~44% off** vs 12× monthly |

Paywall UX: show monthly and annual; **pre-select Annual** with a “Best value” badge.

Store consoles display localized prices; the table above is the **USD list price** to configure in App Store Connect and Google Play.

## Store product IDs

These IDs must match across App Store Connect, Google Play, RevenueCat, and `PRODUCT_IDS` in [`apps/mobile/src/subscription/plan.ts`](../../apps/mobile/src/subscription/plan.ts) (re-exported by `src/utils/revenueCat.ts`).

| Product ID | Type |
|------------|------|
| `muscleos_pro_monthly` | Auto-renewable subscription, 1 month |
| `muscleos_pro_annual` | Auto-renewable subscription, 1 year |

## RevenueCat

| Field | Value |
|-------|-------|
| Entitlement | `MuscleOS Pro` |
| Offering | Default |
| Packages | `$rc_monthly`, `$rc_annual` |

## Code reference

Fallback UI labels (when RC prices aren’t loaded yet) live in [`apps/mobile/src/subscription/pricing.ts`](../../apps/mobile/src/subscription/pricing.ts). The paywall shows the store's localized `priceString` with the period appended, and computes the annual row's “Save N% vs monthly” from the store's numeric prices, falling back to the USD list prices (44%) when either package hasn't loaded or annual isn't cheaper — see `src/subscription/paywall.ts`.

## Rationale

- **$2.99/mo** — impulse-friendly for serious hobby lifters; comparable to a single gym addon.
- **$19.99/yr** — strong annual nudge without feeling expensive.

Adjust prices in store consoles first, then update `pricing.ts` and this doc to stay in sync.
