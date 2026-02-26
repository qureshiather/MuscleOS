import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import type { UserProfile } from '@muscleos/types';
import { useAuthStore } from '@/store/authStore';

export function useSignIn() {
  const setProfile = useAuthStore((s) => s.setProfile);

  async function signInWithApple(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const profile: UserProfile = {
        id: cred.user,
        email: cred.email ?? undefined,
        displayName: cred.fullName
          ? [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(' ') || undefined
          : undefined,
        provider: 'apple',
      };
      await setProfile(profile);
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
      return false;
    }
  }

  async function signInWithGoogle(): Promise<boolean> {
    // Placeholder: requires Google OAuth client ID and backend or deep link.
    // User can add expo-auth-session + Google OAuth later.
    const profile: UserProfile = {
      id: 'google_' + Date.now(),
      email: undefined,
      displayName: 'Google User',
      provider: 'google',
    };
    await setProfile(profile);
    return true;
  }

  async function signInWithEmail(displayName: string, email?: string): Promise<boolean> {
    const profile: UserProfile = {
      id: 'email_' + Date.now(),
      email,
      displayName: displayName || undefined,
      provider: 'email',
    };
    await setProfile(profile);
    return true;
  }

  return { signInWithApple, signInWithGoogle, signInWithEmail };
}
