# Monetization Launch Checklist

Complete before enabling real purchases in production.

## Store & RevenueCat

- [ ] Create `muscleos_pro_monthly` ($2.99) in App Store Connect + Google Play
- [ ] Create `muscleos_pro_annual` ($19.99) in both stores (subscription group on iOS)
- [ ] Create `muscleos_pro_lifetime` ($39.99) as non-consumable / one-time
- [ ] RevenueCat project with iOS + Android apps
- [ ] Entitlement **`MuscleOS Pro`** attached to all three products
- [ ] **Default** offering with `$rc_monthly`, `$rc_annual`, `$rc_lifetime`
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY` set in `apps/mobile/.env`

## Sandbox testing (dev build)

- [ ] Monthly purchase completes and unlocks Pro
- [ ] Annual purchase completes and unlocks Pro
- [ ] Lifetime purchase completes and unlocks Pro (no expiry shown)
- [ ] Restore purchases on a second device / reinstall
- [ ] Subscription lapse removes Pro after RC refresh (sandbox accelerated time)
- [ ] Anonymous user cannot purchase until account is linked

## Feature gates (Basic account)

- [ ] Built-in template workout works
- [ ] Recovery + history work
- [ ] Empty workout → paywall
- [ ] Create template → paywall
- [ ] Add exercise mid-workout → paywall
- [ ] PR / calendar buttons → paywall
- [ ] Deep link `?feature=custom_templates` highlights correct copy

## Account flow

- [ ] Link account → purchase → sign out → sign in → Pro restored
- [ ] Grant Pro (testing) / Reset to Basic works in dev

## Docs & pricing sync

- [ ] Store prices match [pricing.md](pricing.md) and `apps/mobile/src/subscription/pricing.ts`
- [x] Privacy policy / terms mention subscriptions (landing site)
