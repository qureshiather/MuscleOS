# Preview builds (EAS)

Preview builds are **standalone binaries** you can install without Expo Go or a Metro server. They use the `preview` profile in [`apps/mobile/eas.json`](../../apps/mobile/eas.json) (`distribution: "internal"`).

| Platform | Package | What testers get |
|----------|---------|------------------|
| Android | `com.muscleos.app` | APK — anyone with the link can install |
| iOS | `com.muscle-os.app` | Ad hoc IPA — **only registered devices** can install |

Android needs no device list. iOS does: Apple requires each physical iPhone/iPad UDID in the provisioning profile. Register testers first, then build (or re-sign). For inviting people by email with no UDID dance, use [TestFlight](#ios-option-b-testflight) instead.

## Prerequisites

1. Node ≥ 20, pnpm, and repo deps installed (`pnpm install` from root).
2. Expo account (team login: see [README](../../README.md#expo-login)).
3. **iOS only:** paid [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year) and access to the team that owns `com.muscle-os.app`.
4. EAS CLI (one-time):

```bash
npm install -g eas-cli
# or: pnpx eas-cli
```

5. Logged in and linked to the project:

```bash
cd apps/mobile
eas login
eas whoami
```

## One-time: environment variables

Local `apps/mobile/.env` is **gitignored** and is **not** uploaded to EAS. Set the same values on the Expo **preview** environment or auth / Supabase / purchases will fail in the installed app.

### Required

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | From Supabase project settings |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key |

### Recommended for IAP testing

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | Android public key (`goog_…`), **not** the Test Store key |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | iOS public key (`appl_…`), **not** the Test Store key |
| `EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING` | `true` to show **Grant Pro (testing)** on Subscription (remove before store release) |

### Set via dashboard

[expo.dev](https://expo.dev) → MuscleOS project → **Environment variables** → **preview** → add the variables above.

### Or via CLI

```bash
cd apps/mobile

eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --visibility plain-text
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --visibility secret
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value "goog_YOUR_KEY" --visibility secret
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_API_KEY_IOS --value "appl_YOUR_KEY" --visibility secret
eas env:create --environment preview --name EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING --value "true" --visibility plain-text
```

Pull EAS preview env into a local file (optional):

```bash
eas env:pull --environment preview
```

That writes/updates `.env.local`. Prefer keeping day-to-day local values in `.env`.

---

## Android preview

```bash
cd apps/mobile
eas build --platform android --profile preview
```

- First Android build may prompt to generate a keystore — accept the EAS-managed keystore unless you already have one.
- Build runs in the cloud; progress is on [expo.dev](https://expo.dev) and in the terminal.
- Typical wait: ~10–20 minutes.

Monorepo note: `eas-build-post-install` builds `@muscleos/types` so the cloud job has the shared package.

### Install the APK

**Physical device**

1. Open the finished build on [expo.dev](https://expo.dev) (or use the install URL printed by the CLI).
2. On the phone, open the link → download the APK → allow install from that source if prompted.
3. No device registration in EAS is required for Android internal distribution.

**Emulator**

```bash
cd apps/mobile
eas build:run -p android --latest
```

Or download the APK from the dashboard and `adb install path/to/app.apk`.

---

## iOS testers

Two paths. Use **ad hoc** for a handful of known phones (same `preview` profile as Android). Use **TestFlight** when you want to invite people by Apple ID and skip UDIDs.

### Option A: Ad hoc (register each device)

Apple’s ad hoc profile is an allow-list. A new phone cannot install an **already-built** IPA. Register the device, then create a new build (or re-sign).

**1. Register testers’ devices**

```bash
cd apps/mobile
eas device:create
```

- Sign in with the Apple Developer account when prompted.
- Choose **website** registration (URL + QR). Send that link to the tester.
- Tester opens the link **on the iPhone** → installs the Expo registration profile → device UDID is saved with EAS.

List / remove devices later:

```bash
eas device:list
eas device:delete
```

This only registers the device with **Expo**. Apple sees it when the next internal build (or re-sign) includes it in a provisioning profile.

**2. Build (includes registered devices)**

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

- First iOS build: allow EAS to create the distribution cert + ad hoc provisioning profile.
- When asked which devices to include, select **all** registered devices (or the ones you care about).
- Typical wait: ~15–25 minutes.

**New or recently renewed Apple membership:** the first build after adding a device can fail while Apple processes the UDID (up to 24–72 hours). Wait, then run the same build command again.

**3. Install**

1. Open the finished build on [expo.dev](https://expo.dev) (or the install URL from the CLI).
2. On the **registered** iPhone, open the link → install the profile/app if prompted → install MuscleOS.
3. Unregistered phones will fail to install. Register them and rebuild (or re-sign).

**Adding a device after a build already exists**

You do **not** need a full rebuild if the binary is unchanged — re-sign with an updated profile:

```bash
cd apps/mobile
eas device:create          # tester registers on their phone
eas build:resign -p ios --latest --profile preview
```

Or run `eas build --platform ios --profile preview` again.

Apple’s standard program allows **100 devices per device class per year** (iPhone, iPad, etc.).

### Option B: TestFlight (invite by email)

No UDID registration. Testers install via the TestFlight app. Better once App Store Connect is set up.

**1. Production iOS build + submit**

```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios --latest
```

Set the same env vars on the Expo **production** environment (Supabase + `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`). Production builds do not use the `preview` env.

**2. Add testers in App Store Connect**

[App Store Connect](https://appstoreconnect.apple.com) → My Apps → MuscleOS → **TestFlight**:

| Group | Who | Notes |
|-------|-----|--------|
| **Internal** | People already on your App Store Connect team (Users and Access) | Up to 100. Builds available shortly after processing. |
| **External** | Anyone you invite by email | Up to 10,000. First build needs **Beta App Review**. |

Internal testers: **Users and Access** → add their Apple ID with a role (e.g. Developer or Marketing) → TestFlight → Internal group → add them.

External testers: TestFlight → create an external group → add emails → they get an invite and install TestFlight from the App Store.

---

## Rebuild after code or env changes

Env vars are baked in at build time. After changing preview env (or shipping new app code):

```bash
cd apps/mobile
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

Install the new binary over the old one (same package / bundle id). iOS ad hoc: include every current tester device in that build.

---

## RevenueCat: “prepare for release / use production key”

Preview builds are **release**-signed. RevenueCat shows that warning when a **Test Store** API key is used in a release build.

**Fix:** use the real store public keys in the EAS **preview** environment, then rebuild.

| Platform | Env var | Prefix |
|----------|---------|--------|
| Android | `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | `goog_…` |
| iOS | `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | `appl_…` |

Purchases stay sandbox if the device account is a store tester (Google license tester, or Apple Sandbox / TestFlight).

Details: [RevenueCat setup](../monetization/revenuecat-setup.md).

---

## Testing in-app purchases (no real charges)

### Android

1. **Google Play Console** — create/select the app with package **`com.muscleos.app`**.
2. **License testers** — **Setup** → **License testing** (or **Testing** → **License testers**). Add the Gmail used on the test phone.
3. **Optional: Internal testing track** — upload an AAB from `eas build --platform android --profile production`, add the same Gmail as a tester. You can still install the EAS preview APK; same package + license tester → sandbox purchases.
4. Install a preview APK that uses the Android RevenueCat key and test purchases on device.

### iOS

1. **App Store Connect** — app with bundle id **`com.muscle-os.app`**, products created (see [RevenueCat setup](../monetization/revenuecat-setup.md)).
2. **Sandbox testers** — Users and Access → Sandbox → add a tester Apple ID. Sign out of the real App Store on the device (or use Settings → Developer → Sandbox Apple Account on recent iOS) and use that account when the purchase sheet appears.
3. **TestFlight** builds use sandbox IAP automatically for testers.

---

## Profiles (reference)

From `apps/mobile/eas.json`:

| Profile | Use |
|---------|-----|
| `development` | Dev client + internal distribution |
| `preview` | Internal APK (Android) / ad hoc IPA (iOS) for device QA |
| `production` | Store AAB / IPA (auto-increment version); submit this for TestFlight |

Official Expo refs: [Internal distribution](https://docs.expo.dev/build/internal-distribution/), [Build APKs](https://docs.expo.dev/build-reference/apk/), [TestFlight submit](https://docs.expo.dev/submit/ios/).
