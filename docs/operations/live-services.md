# Live services

How to operate the accounts that are already wired. This is not a setup guide. First-time wiring lives in [supabase/setup.md](../supabase/setup.md), [mobile/eas-build.md](../mobile/eas-build.md), and [monetization/revenuecat-setup.md](../monetization/revenuecat-setup.md).

Do not put API keys, SMTP passwords, or OAuth client secrets in this file or in git.

## Where each thing lives

| Service | Owns | Dashboard |
|---------|------|-----------|
| Supabase | Users, auth, database, Edge Functions | [Project](https://supabase.com/dashboard/project/mkhhtzpuwvezwhdpdlaz) |
| Resend | Delivery of auth mail from `noreply@muscleos.app` | [resend.com](https://resend.com) → Domains and Emails |
| Google Cloud | Google sign-in clients | APIs & Services → Credentials, same project as the Web client |
| Apple Developer | Sign in with Apple, push entitlement, signing | [developer.apple.com](https://developer.apple.com/account) → Identifiers → `com.muscle-os.app` |
| Expo | Build env vars (`EXPO_PUBLIC_*`), Android upload keystore, iOS signing | Expo → MuscleOS → Environment variables / Credentials |
| App Store Connect | iOS listing, subscriptions, TestFlight, App Review | App id `6810909876` (`ascAppId` in `apps/mobile/eas.json`) |
| Google Play Console | Android listing, subscriptions, testing tracks, Play App Signing | App `app.muscleos` |
| Website | `https://muscleos.app`, including `/auth/confirm` | The landing app in `apps/landing` |

Public ids:

| | |
|--|--|
| Supabase URL | `https://mkhhtzpuwvezwhdpdlaz.supabase.co` |
| iOS bundle | `com.muscle-os.app` |
| Android package | `app.muscleos` |
| Auth mail from | `noreply@muscleos.app` (sender name **MuscleOS Support**) |
| Support | `support@muscleos.app` |
| App scheme | `muscleos://` |

`apps/mobile/.env` is only for the machine you are developing on. Store builds read the Expo environment for that profile (`preview` or `production`). Changing `.env` does not change an already-installed store or preview build.

## Supabase

Anonymous sign-in stays **on**. The app creates a guest on first launch and upgrades that same user when someone links Apple or Google on that device.

**Confirm email** stays **on**. A new email account cannot sign in until they open the confirmation link.

Authentication → URL configuration:

- Site URL: `https://muscleos.app`
- Redirect allow list: `https://muscleos.app/**`, `muscleos://**`, `https://muscleos.app/auth/confirm`

One Supabase user per email. Apple, Google, and a password on that address are the same account. Deleting the user removes all three. The store subscription is not cancelled.

Authentication → Users is the place to look up or delete an account by hand. If signup shows “Error sending confirmation email”, the user row is rolled back and will not be there. Fix mail, then have them sign up again.

Auth mail limits (Authentication → Rate Limits, and SMTP settings):

| Setting | Current value | What it does |
|---------|---------------|--------------|
| Email send rate | 100 per hour | Supabase refuses the send before Resend. The app shows a failure. |
| Minimum interval | 60 seconds | Same address cannot get another auth email sooner than this. |
| Token verifications | 30 per 5 min per IP (default) | Caps code guessing on `/delete-account`. Don't raise it. |
| Email OTP expiry | 1 hour (default; leave it) | How long a deletion code works. It also applies to signup confirmation and password reset links, so don't shorten it. |

These limits are project-wide, and the Resend free plan (about 100 a day) sits behind them. Someone
spamming signup, password reset, or `/delete-account` for addresses that exist could use up the
hourly send budget and block real confirmation mail for up to an hour. Each address still only gets
one mail a minute, and unknown addresses get no mail at all. If that ever happens, the fix is
Supabase Auth CAPTCHA, which also needs the app to send a CAPTCHA token.

Edge Functions `save-apple-token` and `delete-account` are deployed. Redeploy after changing `supabase/functions/`:

```bash
pnpm supabase functions deploy save-apple-token
pnpm supabase functions deploy delete-account
```

Apple revoke on delete needs `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` in Edge Function secrets, with `APPLE_CLIENT_ID=com.muscle-os.app`. If those are unset, delete still removes the Supabase user and skips the Apple revoke.

## Resend

The domain `muscleos.app` stays **Verified**. Auth mail is not sent by Resend’s API from the app. Supabase SMTP uses:

| | |
|--|--|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key |
| Sender | `noreply@muscleos.app` |

The message body and subject are edited in **Supabase → Authentication → Emails**, not in Resend.

| Mail | Subject | Link |
|------|---------|------|
| Confirm signup | Confirm your email address with MuscleOS | `https://muscleos.app/auth/confirm?token_hash={{ .TokenHash }}&type=signup` |
| Reset password | Reset your MuscleOS password | `https://muscleos.app/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |
| Magic link | Your MuscleOS verification code | **No link.** The body shows `{{ .Token }}` only |

The **Magic link** template is only used by `https://muscleos.app/delete-account`. The app never
sends magic links. The page asks for the code, so the template must show `{{ .Token }}` and must
not include `{{ .ConfirmationURL }}`. Suggested body: “Your MuscleOS verification code is
{{ .Token }}. It expires in 1 hour. If you didn't ask to delete your MuscleOS account, ignore
this email.”

Keep the MuscleOS name in the subject. A generic subject such as “Reset Your Password” lands in spam. Do not switch the link back to `{{ .ConfirmationURL }}`. That URL verifies the token as soon as Gmail or a spam filter fetches it, and the person’s tap then shows `otp_expired`.

Resend → Emails shows whether a message was accepted. **Delivered** means the inbox provider accepted it; if it is missing, check Spam. **Bounced** will not arrive. A message that appears in Resend was not rate-limited. A rate limit fails the send and the row is absent.

Leave click tracking and open tracking off for this domain. A rewritten link is another hop in front of the confirm page.

The free plan caps how many messages Resend will send (on the order of 100 a day and 3,000 a month). Past that, signup and reset fail until the next window or a paid plan. Confirm the numbers on the Resend plan page if the plan changes.

`support@muscleos.app` is the public support address. It is not the auth sender. Keep that mailbox forwarded to whoever answers support.

## Google sign-in

Web client and Android client must be in the **same** Google Cloud project.

| Client | Used for |
|--------|----------|
| Web | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and Supabase → Authentication → Providers → Google (client id + secret). This is not the Android client id. |
| Android "MuscleOS Android" | Package `app.muscleos` + **current Play app signing** key (classical) SHA-1 `F6:76:42:21:BB:94:0C:27:73:67:66:01:BB:92:1C:9D:CB:F7:AF:AB`. |
| Android, previous signing key | Package `app.muscleos` + **previous Play app signing** key SHA-1 `0F:E2:69:26:8D:3C:71:68:0E:B5:9E:55:9F:04:AB:64:51:59:06:2D`. Covers installs from the first Play releases, and Android 12 and older, which keep verifying the original key after a rotation. |
| Android "MuscleOS Android (upload key)" | Package `app.muscleos` + EAS **upload key** SHA-1 `99:B2:73:C3:3E:53:CE:2B:69:D7:27:CB:9C:D5:A5:55:84:BF:D9:87`. Covers AABs/APKs installed without Play. |

Authorized redirect on the Web client: `https://mkhhtzpuwvezwhdpdlaz.supabase.co/auth/v1/callback`.

A new signing key needs its SHA-1 on an Android client before Google sign-in works for builds signed with that key. Each Android client holds one SHA-1, so every key gets its own client with the same package. **Play app signing was rotated** (Play Console → App integrity → *Change key*, to the quantum-ready key): installs signed with the previous key failed with `DEVELOPER_ERROR` until its SHA-1 was added. If the key changes again, add the new SHA-1 (and the post-quantum one) as further clients, and keep the old ones. Debug, EAS, and Play app signing are different certificates. `DEVELOPER_ERROR` is a package, SHA-1, or Web client id mismatch. The Web client id is baked in at build time, so fixing the Expo env var requires a new build.

iOS Google sign-in still uses the browser OAuth flow. There is no separate iOS OAuth client yet.

## Apple sign-in

The App ID `com.muscle-os.app` keeps **Sign in with Apple** enabled. The app requests the time-sensitive notification entitlement for rest alerts; that capability stays on the same App ID or production signing fails.

Native Sign in with Apple does not use a Services ID. The bundle id is the client id.

When the Apple signing key used for revoke is rotated, update `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` on the `delete-account` function. Old refresh tokens can still be revoked with the old key until Apple expires them.

## Website

Email links open `https://muscleos.app/auth/confirm`. That page has to be the deployed landing app. If it is an old deploy, an expired link still says “Open MuscleOS” instead of telling the person to request a new one. Privacy and terms are `https://muscleos.app/privacy` and `https://muscleos.app/terms`.

`https://muscleos.app/delete-account` is the account-deletion link for the Play Console Data
safety form. It needs two **public** env vars on the Vercel project, and they're baked in at build
time, so redeploy after setting them:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mkhhtzpuwvezwhdpdlaz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The same anon key the app ships with (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) |

Without them the page still loads, but only offers the email-support path. `apps/landing/vercel.json`
sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every page, so the delete button
can't be clickjacked.

## Google Play

The Android application id is `app.muscleos`. `com.muscleos.app` belongs to another developer on
Play, and an application id can never change once published. The Kotlin namespace is still
`com.muscleos.app`; only the published id differs.

- **Play App Signing** is on. Google holds the app signing key and re-signs every install; its
  SHA-1 is on the Google sign-in Android client above. We sign uploads with the **upload key**,
  which EAS stores (Expo → Credentials → Android → `app.muscleos`). EAS only creates or rotates it
  through the interactive `npx eas-cli credentials -p android`, which has to run in a real terminal.
- **The first AAB had to be uploaded by hand** in Play Console. `eas submit -p android` needs the
  Google service account (the same one RevenueCat uses) with release permissions.
- **Production access:** this is a personal developer account, so Play requires a closed test with at
  least 12 opted-in testers for 14 consecutive days before **Apply for production access** unlocks.
  Testers are managed on the closed track's **Testers** tab and join through its opt-in link.
- **Store review accounts:** Apple and Google each have their own demo account. Apple's stays on
  **Basic** so the reviewer can test the purchase flow. Google's has a complimentary lifetime Pro
  grant, because Play's App access form asks for full access to paid features. Credentials live in
  each console's review form, not in git.

## Builds and purchases

Preview and production env vars, and how to ship a binary, are in [mobile/eas-build.md](../mobile/eas-build.md). Product ids, the **MuscleOS Pro** entitlement, and the RevenueCat dashboard are in [monetization/revenuecat-setup.md](../monetization/revenuecat-setup.md).

After changing a public `EXPO_PUBLIC_*` value, rebuild. A reload does not pick up a new client id or API key.
