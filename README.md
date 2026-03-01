
Login with Expo Credentials

## Subscriptions (RevenueCat) & local testing

- **No account required for testing:** In development builds, the Subscription screen shows a **"Grant Pro (testing)"** button (dev only). Use it to unlock Pro and test custom templates, custom exercises, and adding exercises to workouts.
- **Real IAP:** Create a [RevenueCat](https://www.revenuecat.com) project, add an entitlement named `pro`, create an offering with your App Store / Play products, then set your **public** API key:
  - In `apps/mobile`: create `.env` with `EXPO_PUBLIC_REVENUECAT_API_KEY=your_public_key` (or set in `app.config.js` `extra.revenueCatApiKey`).
  - Use an **Expo development build** (not Expo Go) to test real purchases; use Apple/Google sandbox accounts.
- **Expo Go:** RevenueCat runs in preview/mock mode in Expo Go; use "Grant Pro (testing)" to simulate Pro.

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