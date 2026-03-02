/** Expo config. Use EXPO_PUBLIC_* vars (e.g. in .env) for RevenueCat and Supabase. */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
});
