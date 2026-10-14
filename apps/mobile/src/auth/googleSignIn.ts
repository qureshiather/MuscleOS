import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Google Cloud Web OAuth client id: `extra.googleWebClientId` (app.config.js, build time) first,
 * then the Metro-inlined env var — the same order as the Supabase keys.
 */
export function resolveGoogleWebClientId(extra: Record<string, unknown> | undefined, envValue: string | undefined): string {
  const fromExtra = typeof extra?.googleWebClientId === 'string' ? extra.googleWebClientId.trim() : '';
  return fromExtra || envValue?.trim() || '';
}

export function googleWebClientId(): string {
  return resolveGoogleWebClientId(
    Constants.expoConfig?.extra as Record<string, unknown> | undefined,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  );
}

/** Google Cloud iOS OAuth client id (`extra.googleIosClientId` in app.json). Public, like the web id. */
export function resolveGoogleIosClientId(extra: Record<string, unknown> | undefined): string {
  return typeof extra?.googleIosClientId === 'string' ? extra.googleIosClientId.trim() : '';
}

export function googleIosClientId(): string {
  return resolveGoogleIosClientId(Constants.expoConfig?.extra as Record<string, unknown> | undefined);
}

export type GoogleTokens = { idToken: string; accessToken?: string };

/**
 * Native Google Sign-In on both platforms: Play Services on Android, the GoogleSignIn SDK on iOS
 * (its iOS client id, with the web id as the server client so Supabase accepts the token).
 */
async function nativeIdToken(): Promise<GoogleTokens | null> {
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    webClientId: googleWebClientId(),
    ...(Platform.OS === 'ios' ? { iosClientId: googleIosClientId() } : {}),
    offlineAccess: false,
  });

  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;

  const idToken = response.data.idToken;
  if (!idToken) return null;

  let accessToken: string | undefined;
  try {
    const tokens = await GoogleSignin.getTokens();
    accessToken = tokens.accessToken || undefined;
  } catch {
    // idToken is enough for Supabase.
  }
  return { idToken, accessToken };
}

export async function getGoogleTokens(): Promise<GoogleTokens | null | 'cancelled'> {
  try {
    return await nativeIdToken();
  } catch (e) {
    const { isErrorWithCode, statusCodes } = await import('@react-native-google-signin/google-signin');
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
    throw e;
  }
}

/** Best-effort so the next Google picker is not stuck on the last account. */
export async function signOutGoogle(): Promise<void> {
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Not signed into Google on this device.
  }
}
