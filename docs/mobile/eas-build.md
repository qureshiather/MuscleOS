# Android preview builds (EAS)

Preview builds are **standalone APKs** you can install on a phone or emulator without Expo Go or a Metro server. They use the `preview` profile in [`apps/mobile/eas.json`](../../apps/mobile/eas.json) (`distribution: "internal"` → APK).

Package name: **`com.muscleos.app`**.

## Prerequisites

1. Node ≥ 20, pnpm, and repo deps installed (`pnpm install` from root).
2. Expo account (team login: see [README](../../README.md#expo-login)).
3. EAS CLI (one-time):

```bash
npm install -g eas-cli
# or: pnpx eas-cli
```

4. Logged in and linked to the project:

```bash
cd apps/mobile
eas login
eas whoami
```

## One-time: environment variables

Local `apps/mobile/.env` is **gitignored** and is **not** uploaded to EAS. Set the same values on the Expo **preview** environment or auth / Supabase / purchases will fail in the installed APK.

### Required

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | From Supabase project settings |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key |

### Recommended for IAP testing

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | Android public key (`goog_…`), **not** the Test Store key |
| `EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING` | `true` to show **Grant Pro (testing)** on Subscription (remove before store release) |

### Set via dashboard

[expo.dev](https://expo.dev) → MuscleOS project → **Environment variables** → **preview** → add the variables above.

### Or via CLI

```bash
cd apps/mobile

eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --visibility plain-text
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --visibility secret
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value "goog_YOUR_KEY" --visibility secret
eas env:create --environment preview --name EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING --value "true" --visibility plain-text
```

Pull EAS preview env into a local file (optional):

```bash
eas env:pull --environment preview
```

That writes/updates `.env.local`. Prefer keeping day-to-day local values in `.env`.

## Create a preview build

From the mobile app directory:

```bash
cd apps/mobile
eas build --platform android --profile preview
```

- First Android build may prompt to generate a keystore — accept the EAS-managed keystore unless you already have one.
- Build runs in the cloud; progress is on [expo.dev](https://expo.dev) and in the terminal.
- Typical wait: ~10–20 minutes.

Monorepo note: `eas-build-post-install` builds `@muscleos/types` so the cloud job has the shared package.

## Install the APK

### Physical device

1. Open the finished build on [expo.dev](https://expo.dev) (or use the install URL printed by the CLI).
2. On the phone, open the link → download the APK → allow install from that source if prompted.
3. No device registration in EAS is required for Android internal distribution.

### Emulator

```bash
cd apps/mobile
eas build:run -p android --latest
```

Or download the APK from the dashboard and `adb install path/to/app.apk`.

## Rebuild after code or env changes

Env vars are baked in at build time. After changing preview env (or shipping new app code):

```bash
cd apps/mobile
eas build --platform android --profile preview
```

Install the new APK over the old one (same package name).

---

## RevenueCat: “prepare for release / use production key”

Preview builds are **release**-signed. RevenueCat shows that warning when a **Test Store** API key is used in a release build.

**Fix:** use the real **Android** public API key (`goog_…`) as `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` (or legacy `EXPO_PUBLIC_REVENUECAT_API_KEY`) in the EAS **preview** environment, then rebuild.

Purchases stay sandbox if the Google account on the device is a **license tester** (below).

Details: [RevenueCat setup](../monetization/revenuecat-setup.md).

---

## Testing in-app purchases (no real charges)

1. **Google Play Console** — create/select the app with package **`com.muscleos.app`**.
2. **License testers** — **Setup** → **License testing** (or **Testing** → **License testers**). Add the Gmail used on the test phone.
3. **Optional: Internal testing track** — upload an AAB from `eas build --platform android --profile production`, add the same Gmail as a tester. You can still install the EAS preview APK; same package + license tester → sandbox purchases.
4. Install a preview APK that uses the Android RevenueCat key and test purchases on device.

---

## Profiles (reference)

From `apps/mobile/eas.json`:

| Profile | Use |
|---------|-----|
| `development` | Dev client + internal distribution |
| `preview` | Internal APK for device/emulator QA |
| `production` | Store AAB (auto-increment version) |

Official Expo refs: [Internal distribution](https://docs.expo.dev/build/internal-distribution/), [Build APKs](https://docs.expo.dev/build-reference/apk/).
