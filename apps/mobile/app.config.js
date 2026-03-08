/**
 * Expo config. Loads .env from apps/mobile so EXPO_PUBLIC_* vars are available
 * in extra (and thus in the app via Constants.expoConfig.extra).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    enableGrantProTesting: process.env.EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING === 'true',
  },
});
