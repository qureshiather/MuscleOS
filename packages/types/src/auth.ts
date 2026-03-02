export type AuthProvider = 'apple' | 'google' | 'email';

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  provider: AuthProvider;
  /** Avatar URL if available */
  photoUrl?: string;
  /** Stable account ID for RevenueCat / backend (e.g. Supabase user.id) */
  accountId?: string;
}
