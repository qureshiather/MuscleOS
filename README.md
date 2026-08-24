
Login with Expo Credentials

## Subscriptions (RevenueCat) & local testing

MuscleOS has **Basic** (free) and **Pro** tiers. Pro is available as monthly ($2.99), annual ($19.99), or lifetime ($39.99).

Full specs: [`docs/monetization/`](docs/monetization/)

- **Entitlement:** `MuscleOS Pro` (single entitlement for all paid plans)
- **Product IDs:** `muscleos_pro_monthly`, `muscleos_pro_annual`, `muscleos_pro_lifetime`
- **Setup guide:** [`apps/mobile/REVENUECAT_SETUP.md`](apps/mobile/REVENUECAT_SETUP.md)
- **Testing:** Dev builds show **Grant Pro (testing)** on the Subscription screen. Use it to test Pro gates without IAP.
- **Real IAP:** Set `EXPO_PUBLIC_REVENUECAT_API_KEY` in `apps/mobile/.env`. Use an **Expo development build** (not Expo Go) with Apple/Google sandbox accounts.
- **Account required to purchase:** Link an account (Supabase) before subscribing; Pro restores via RevenueCat on any device when signed in.

## Set up Expo MCP

1. `cd apps/mobile`
2. `pnpx expo login`

Enter In the Credentials
username: twaxter
password: (The usual)

3. Start the Dev Server with MCP Capabilities

`EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`

## Start Dev Server

Start the Expo Dev Server
`pnpm dev`