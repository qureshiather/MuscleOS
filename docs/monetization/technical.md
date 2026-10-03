# Subscriptions — Technical Spec

How billing is wired. For what each tier includes and where gates are enforced, see
[features/subscriptions.md](../features/subscriptions.md).

## Architecture

```mermaid
flowchart LR
  subgraph client [Mobile app]
    UI[Screens + gates]
    Store[subscriptionStore]
    Cache[AsyncStorage]
  end
  subgraph external [External services]
    RC[RevenueCat SDK]
    SB[Supabase Auth]
    ASC[App Store / Play]
  end
  UI --> Store
  Store --> RC
  Store --> Cache
  RC --> ASC
  SB -->|user.id as appUserID| RC
```

| Responsibility | Owner |
|----------------|-------|
| User identity | Supabase Auth |
| Billing & entitlements | RevenueCat |
| Offline tier cache | AsyncStorage (`muscleos_subscription`) |
| Feature access checks | `subscriptionStore.isPro()` + gates |

## Types

[`packages/types/src/subscription.ts`](../../packages/types/src/subscription.ts):

```ts
type SubscriptionTier = 'basic' | 'pro';
type SubscriptionPlan = 'monthly' | 'annual' | 'complimentary' | null;

interface SubscriptionState {
  tier: SubscriptionTier;
  expiresAt?: string;
  plan?: SubscriptionPlan;
}
```

Legacy `tier: 'free'` in AsyncStorage migrates to `'basic'` on read.

## RevenueCat integration

File: [`apps/mobile/src/utils/revenueCat.ts`](../../apps/mobile/src/utils/revenueCat.ts)

- Entitlement: **`MuscleOS Pro`**
- Products: `muscleos_pro_monthly`, `muscleos_pro_annual`
- `getOfferingPackages()` → `{ monthly, annual }`
- `purchasePackage(pkg)` → updates `CustomerInfo`
- `hasProEntitlement()` is the source of truth for Pro access

Configure the platform public keys in `apps/mobile/.env`:
`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` (`appl_`) and
`EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` (`goog_`).
`EXPO_PUBLIC_REVENUECAT_API_KEY` is supported only as a legacy fallback.

## Subscription store

File: [`apps/mobile/src/store/subscriptionStore.ts`](../../apps/mobile/src/store/subscriptionStore.ts)

| Method | Purpose |
|--------|---------|
| `hydrate()` | Paint the cached tier at launch, before auth resolves |
| `load(appUserId?)` | Configure RC, then settle the tier with `resolveSubscriptionState` (`src/subscription/state.ts`). A failed / timed-out customer read keeps the cached tier |
| `isPro()` | `isProState(state, now)`: tier is pro and not expired |
| `purchasePackage(pkg)` | IAP + persist state |
| `restorePurchases()` | Restore from store |
| `setPro()` / `setBasic()` | Dev testing only |

Loaded on app init in [`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx). Refreshed when app returns to foreground.

## Supabase

File: [`apps/mobile/src/lib/supabase.ts`](../../apps/mobile/src/lib/supabase.ts)

- Anonymous sign-in on first launch
- Account linking (Apple, Google, email) before purchase
- `authStore` calls `revenueCatLogIn(user.id)` after link/sign-in
- **No subscription table in Supabase today** — RC SDK only

### Purchase rule

Anonymous users see the paywall (feature highlight, comparison, prices) with **Link account to purchase** in place of the purchase button; `purchasePackage` / `restorePurchases` refuse guests.

## Phase 2: server-side sync (optional)

Not required for launch.

1. `profiles` table: `subscription_tier`, `plan`, `rc_customer_id`, `updated_at`
2. RevenueCat webhook → Supabase Edge Function (`INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION`, `CANCELLATION`)
3. Client still prefers RC SDK; Supabase for audit, support, and future cloud backup

## Dev & testing

| Mode | How |
|------|-----|
| Expo Go / dev build | **Grant Pro (testing)** (`__DEV__` only) |
| Dev build + sandbox | Real IAP with test Apple/Google accounts |
| Release builds | Sandbox purchases or a [promotional entitlement](../features/subscriptions.md#complimentary-pro) |

See [revenuecat-setup.md](revenuecat-setup.md) for dashboard setup steps.
