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

Two paths. Use **ad hoc** (the playbook below) for a handful of known phones — same `preview` profile as Android. Use [TestFlight](#ios-option-b-testflight) when you want to invite people by Apple ID and skip UDIDs.

### Option A: Ad hoc preview (register → resign or build → send install link)

Apple’s ad hoc profile is an allow-list. A phone can install an IPA only if its UDID is in **that IPA’s** provisioning profile.

There are two lists. They are not the same:

| List | What it is | Command / where |
|------|------------|-----------------|
| Expo registered devices | Phones that completed the registration link | `eas device:list` |
| Devices on a given build | Phones baked into that IPA’s profile | Chosen when you **build** or **resign** |

A new tester is not done after they register. They only appear in `eas device:list`. They cannot open an **old** install URL until you **resign** (or rebuild) and send them the **new** URL.

All commands below run from `apps/mobile`, logged into EAS and the Apple team that owns `com.muscle-os.app`.

#### 1. See who is already registered

```bash
cd apps/mobile
eas device:list
```

You will be asked for the Apple team. The table is name, UDID, class (iPhone / iPad), and whether Expo has the device.

Same list in the browser: [expo.dev](https://expo.dev) → MuscleOS project → **Credentials** (or **Devices**).

```bash
eas device:delete    # remove a device from Expo (optional: also disable it on Apple)
```

Apple’s standard program allows **100 devices per device class per year** (iPhone, iPad, …).

#### 2. Generate a registration link to send people

```bash
cd apps/mobile
eas device:create
```

Prompts:

1. Use this Expo account? **Yes**
2. Apple ID + team (the MuscleOS team)
3. How would you like to register devices? **Website**

Do **not** pick Developer Portal or typing a UDID unless you already have the UDID. **Website** is what you send to non-technical testers.

The CLI prints a **registration URL** and a QR code. Copy the URL and send it (iMessage, email, Slack). The same link can be reused for several people.

This link is **not** the app. It only registers the phone.

#### 3. What the tester does on their iPhone

They must do this **on the iPhone**, not a computer.

1. Open the registration URL in Safari (or scan the QR with Camera).
2. Tap **Download Profile**.
3. Open **Settings** — iOS shows **Profile Downloaded** (or Settings → General → VPN & Device Management).
4. Tap the Expo / MuscleOS registration profile → **Install**.
5. Tell you they finished.

Confirm they landed:

```bash
eas device:list
```

Their phone should appear. Until it does, do not resign or build for them.

Registering only saves the UDID with Expo. Apple (and an existing IPA) do not know about them yet.

#### 4. Resign the latest preview so new people can install it

Use this when the app code is unchanged and you only added testers. Resigning re-signs the existing IPA with an updated ad hoc profile — minutes, not a full 15–25 minute compile.

```bash
cd apps/mobile
eas build:resign -p ios --latest --profile preview
```

Then in the prompts:

1. Select the latest **preview** iOS build (the IPA you want them to run).
2. Log in to Apple if asked.
3. When it offers **Show devices and ask me again**, do that.
4. Select **all** devices that should be able to install — old testers **and** the new ones. If you omit someone, their old install URL may still work but this new URL will not.

EAS starts a short job that reuses the binary and stamps a new profile. When it finishes, the CLI and [expo.dev](https://expo.dev) show a **new build / install URL**.

Send testers **that new URL**. The previous install link still has the old device list; new phones will fail on it.

If Apple just added the UDID (new membership or first time that device appeared), resign/build can fail for 24–72 hours. Wait and run the same resign command again.

#### 5. Full preview build (first time, or after code / env changes)

Need a new binary? Full build. First iOS preview: allow EAS to create the distribution cert + ad hoc profile.

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

When asked which devices to include, select **all** registered testers. Typical wait: ~15–25 minutes.

After **code or preview env** changes you must full-build. Resign only updates who can install; it does not pick up new JS or env vars.

#### 6. Send the install link

From the finished **build** or **resign** job:

1. Copy the install URL from the CLI, or open [expo.dev](https://expo.dev) → MuscleOS → **Builds** → that iOS preview job.
2. Send testers that URL (not the registration URL from step 2).
3. On a **registered** iPhone that was **included in that job**, they open the link → follow the install prompts → MuscleOS.

If install fails: they are missing from `eas device:list`, or they were not selected on that resign/build. Register (if needed), resign again, send the newest URL.

**Quick recap**

```text
eas device:create     →  send registration URL  →  tester installs profile on iPhone
eas device:list       →  confirm they show up
eas build:resign …    →  if the current preview binary is fine
eas build … preview   →  if you need a new binary
                      →  send the NEW install URL from that job
```

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
