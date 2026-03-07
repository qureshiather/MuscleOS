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
   (Optionally: `EXPO_PUBLIC_REVENUECAT_API_KEY` for IAP.)

2. **Or CLI**
   ```bash
   cd apps/mobile
   eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --visibility plain-text
   eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --visibility secret
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
