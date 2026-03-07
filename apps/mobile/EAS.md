# EAS Build (preview on device)

To run a build on your phone:

```bash
eas build --platform android --profile preview
```

Your local `.env` is **not** uploaded (it’s gitignored). For the built app to have Supabase (and “link account”) working, set the same variables in EAS for the **preview** environment.

## Set env vars for preview builds

1. **Expo dashboard**  
   [expo.dev](https://expo.dev) → your project → **Environment variables** → choose **preview**. Add:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
   For RevenueCat on preview use your **Android** API key (see section below), not the Test Store key.
   - To show **Grant Pro (testing)** on the Subscription screen in preview builds, add `EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING` = `true` (plain text). Remove this before going live.

2. **Or CLI**
   ```bash
   cd apps/mobile
   eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --visibility plain-text
   eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --visibility secret
   eas env:create --environment preview --name EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING --value "true" --visibility plain-text
   ```

3. **Or pull from EAS into local** (for reference; your existing `.env` is fine for local dev):
   ```bash
   eas env:pull --environment preview
   ```
   That creates/updates `.env.local` from EAS (you can copy values into `.env` if you like).

After the variables are set for **preview**, run:

```bash
eas build --platform android --profile preview
```

The build will use those values and the installed app will have Supabase configured.

---

## RevenueCat: stop “prepare for release / use production key” on preview

Preview builds are **release** builds. RevenueCat shows that dialog when you use a **Test Store** API key in a release build.

**Fix:** Use your **Android (platform) API key** for preview, not the Test Store key.

1. In [RevenueCat](https://app.revenuecat.com) go to **Project** → **API keys**.
2. Under your **Android** app, copy the **Public API key** (the real Android key, not “Test Store”).
3. Set that as `EXPO_PUBLIC_REVENUECAT_API_KEY` in EAS for the **preview** environment.
4. Rebuild: `eas build --platform android --profile preview`.

Purchases on your device stay in **sandbox** as long as your Google account is a license tester (see below).

---

## Add your Android for testing (install + in-app purchases)

### Installing the app

After the build finishes, open the build on [expo.dev](https://expo.dev), use **Download** or the build link, and open it on your Android phone to install. You don’t need to “add” the device in EAS for internal distribution.

### Testing in-app purchases (no real charges)

To test subscriptions without being charged:

1. **Google Play Console**  
   [Play Console](https://play.google.com/console) → your app (create one if needed). Package name must be **`com.muscleos.app`**.

2. **License testers**  
   In your app: **Setup** → **License testing** (or **Testing** → **License testers**). Add the **Gmail address** you use on your Android phone. That account gets test purchases (no real charge).

3. **Internal testing track**  
   **Release** → **Testing** → **Internal testing** → create a release and upload an AAB (e.g. from `eas build --platform android --profile production`). Add your Gmail as a tester for the internal test track. You can then install from the Play internal test link, or keep installing the EAS preview APK; with the same package and your account as license tester, test purchases work.

4. **On your phone**  
   Use the **Android** RevenueCat key in EAS preview (above), rebuild, install the new APK. Your device is set for testing; purchases are sandbox.
