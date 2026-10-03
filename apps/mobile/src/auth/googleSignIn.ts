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

export type GoogleTokens = { idToken: string; accessToken?: string };

async function nativeAndroidIdToken(): Promise<GoogleTokens | null> {
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    webClientId: googleWebClientId(),
    offlineAccess: false,
  });

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
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

async function authSessionIdToken(): Promise<GoogleTokens | null> {
  const { makeRedirectUri, AuthRequest, ResponseType } = await import('expo-auth-session');
  const { maybeCompleteAuthSession } = await import('expo-web-browser');

  const redirectUri = makeRedirectUri({ scheme: 'muscleos', path: 'auth' });
  maybeCompleteAuthSession();

  const request = new AuthRequest({
    clientId: googleWebClientId(),
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: ResponseType.IdToken,
    usePKCE: true,
  });

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params?.id_token) return null;
  return {
    idToken: result.params.id_token,
    accessToken: result.params.access_token,
  };
}

/** Native Play Sign-In on Android; browser OAuth on iOS. */
export async function getGoogleTokens(): Promise<GoogleTokens | null | 'cancelled'> {
  try {
    const tokens =
      Platform.OS === 'android' ? await nativeAndroidIdToken() : await authSessionIdToken();
    return tokens;
  } catch (e) {
    if (Platform.OS === 'android') {
      const { isErrorWithCode, statusCodes } = await import('@react-native-google-signin/google-signin');
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
    }
    throw e;
  }
}

/** Best-effort so the next Google picker is not stuck on the last account. */
export async function signOutGoogle(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Not signed into Google on this device.
  }
}
