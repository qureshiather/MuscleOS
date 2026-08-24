# RevenueCat & Store Product Setup

Manual steps required before real IAP works in production. Product IDs must match [`src/utils/revenueCat.ts`](src/utils/revenueCat.ts).

**Full specs:** [`../../docs/monetization/`](../../docs/monetization/)

## Entitlement

| Field | Value |
|-------|-------|
| Identifier | `MuscleOS Pro` |

All paid products grant this single entitlement (subscriptions + lifetime).

## App Store Connect / Google Play products

| Product ID | Type | Price (USD) |
|------------|------|-------------|
| `muscleos_pro_monthly` | Auto-renewable subscription, 1 month | $2.99 |
| `muscleos_pro_annual` | Auto-renewable subscription, 1 year | $19.99 |
| `muscleos_pro_lifetime` | Non-consumable (iOS) / one-time (Android) | $39.99 |

Create a subscription group for monthly + annual on iOS. Attach lifetime as a separate non-consumable.

## RevenueCat dashboard

1. Create project and add iOS + Android apps.
2. Create entitlement **`MuscleOS Pro`** and attach all three products.
3. Create **Default** offering with packages:
   - `$rc_monthly` → `muscleos_pro_monthly`
   - `$rc_annual` → `muscleos_pro_annual`
   - `$rc_lifetime` → `muscleos_pro_lifetime`
4. Copy the **public** SDK API key into `apps/mobile/.env`:

   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY=your_public_key
   ```

## Supabase identity

- RevenueCat `appUserID` = Supabase `user.id` (set on app init and after account link).
- Users must link an account before purchasing (anonymous guests see a link-account prompt).
- Restore purchases on a new device after signing in with the same account.

## Testing

- Use an **Expo development build** (not Expo Go) with sandbox Apple/Google accounts.
- In dev, enable **Grant Pro (testing)** on the Subscription screen, or set `EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING=true`.
- Verify: monthly purchase, annual purchase, lifetime purchase, restore, and lapse after sandbox expiry.

See [`../../docs/monetization/launch-checklist.md`](../../docs/monetization/launch-checklist.md) for the full checklist.

## Phase 2 (optional)

RevenueCat webhooks → Supabase Edge Function for server-side subscription audit and future cloud sync. Client continues to use the RevenueCat SDK as source of truth.
