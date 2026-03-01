/** Expo config. Use EXPO_PUBLIC_REVENUECAT_API_KEY to set RevenueCat API key (e.g. in .env). */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '',
  },
});
