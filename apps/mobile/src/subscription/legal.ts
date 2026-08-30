/** Public legal pages — must stay reachable for App Store / Play subscription review. */
export const LEGAL_URLS = {
  privacy: 'https://muscleos.app/privacy',
  terms: 'https://muscleos.app/terms',
} as const;

export const STORE_SUBSCRIPTION_URLS = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const;
