# Monetization Launch Checklist

Complete before enabling real purchases in production.

## Store & RevenueCat

Still required before live IAP.

- [ ] Create `muscleos_pro_monthly` ($2.99) in App Store Connect + Google Play
- [ ] Create `muscleos_pro_annual` ($19.99) in both stores (subscription group on iOS)
- [ ] Create `muscleos_pro_lifetime` ($39.99) as non-consumable / one-time
- [ ] RevenueCat project with iOS + Android apps
- [ ] Entitlement **`MuscleOS Pro`** attached to all three products
- [ ] **Default** offering with `$rc_monthly`, `$rc_annual`, `$rc_lifetime`
- [ ] Platform API keys in `apps/mobile/.env`: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` (`appl_`) and `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` (`goog_`)
- [ ] Store prices match [pricing.md](pricing.md) and `apps/mobile/src/subscription/pricing.ts`

## App paywall (shipped)

- [x] Account required before purchase (anonymous users see Link account)
- [x] Monthly / annual / lifetime plans; annual pre-selected with “Best value”
- [x] User-cancelled purchases do not show an error
- [x] Restore purchases reports success or “no purchases found”
- [x] Manage subscription for active Pro (store sheet / account page)
- [x] Auto-renew disclosure + Privacy Policy / Terms of Use links
- [x] RevenueCat setup copy is `__DEV__` only
- [x] Grant Pro (testing) / Reset to Basic remains available in dev

## Landing & legal (shipped)

- [x] Real app screenshots on the marketing site (Workouts, Exercises, Recovery, History)
- [x] Privacy policy / terms mention subscriptions, auto-renew, Apple/Google, and RevenueCat
- [ ] Landing deployed at `https://muscleos.app` so in-app Privacy / Terms links resolve

## Sandbox testing (dev build)

- [ ] Monthly purchase completes and unlocks Pro
- [ ] Annual purchase completes and unlocks Pro
- [ ] Lifetime purchase completes and unlocks Pro (no expiry shown)
- [ ] Restore purchases on a second device / reinstall
- [ ] Subscription lapse removes Pro after RC refresh (sandbox accelerated time)
- [ ] Anonymous user cannot purchase until account is linked
- [ ] Link account → purchase → sign out → sign in → Pro restored

## Feature gates (Basic account)

- [ ] Built-in template workout works
- [ ] Recovery + history work
- [ ] Empty workout → paywall
- [ ] Create template → paywall
- [ ] Add exercise mid-workout → paywall
- [ ] PR / calendar buttons → paywall
- [ ] Deep link `?feature=custom_templates` highlights correct copy
