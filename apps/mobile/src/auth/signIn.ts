import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, Alert } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { revenueCatLogIn } from '@/utils/revenueCat';

export function useSignIn() {
  async function linkWithApple(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    if (!isSupabaseConfigured()) {
      Alert.alert('Not configured', 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
      return false;
    }
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = cred.identityToken;
      if (!idToken) {
        Alert.alert('Sign in failed', 'Apple did not return an identity token.');
        return false;
      }
      const { error } = await supabase.auth.linkIdentity({
        provider: 'apple',
        token: idToken,
      });
      if (error) {
        Alert.alert('Link failed', error.message);
        return false;
      }
      if (cred.fullName) {
        const fullName = [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(' ');
        if (fullName) {
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          });
        }
      }
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
      Alert.alert('Apple Sign In failed', (e as Error).message);
      return false;
    }
  }

  async function linkWithGoogle(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not configured', 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
      return false;
    }
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
    if (!clientId) {
      Alert.alert(
        'Google Sign-In not configured',
        'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env and configure Google OAuth in Supabase dashboard. Use @react-native-google-signin/google-signin for native flows.'
      );
      return false;
    }
    try {
      const { makeRedirectUri } = await import('expo-auth-session');
      const { AuthRequest } = await import('expo-auth-session');
      const { ResponseType } = await import('expo-auth-session');
      const { maybeCompleteAuthSession } = await import('expo-web-browser');

      const redirectUri = makeRedirectUri({ scheme: 'muscleos', path: 'auth' });
      maybeCompleteAuthSession();

      const request = new AuthRequest({
        clientId,
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

      if (result.type !== 'success' || !result.params?.id_token) {
        return false;
      }

      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        token: result.params.id_token,
        access_token: result.params.access_token,
      });
      if (error) {
        Alert.alert('Link failed', error.message);
        return false;
      }
      return true;
    } catch (e) {
      Alert.alert('Google Sign-In failed', (e as Error).message);
      return false;
    }
  }

  async function signInWithEmailOnly(email: string, password: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not configured', 'Supabase is not configured.');
      return false;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('confirm your email')) {
          Alert.alert('Confirm your email', 'Check your inbox for a confirmation link from Supabase, then try signing in again.');
        } else {
          Alert.alert('Sign in failed', error.message);
        }
        return false;
      }
      if (data.session?.user?.id) {
        await revenueCatLogIn(data.session.user.id);
      }
      return true;
    } catch (e) {
      Alert.alert('Sign in failed', (e as Error).message);
      return false;
    }
  }

  async function linkWithEmail(email: string, password: string, displayName?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      Alert.alert('Not configured', 'Supabase is not configured.');
      return false;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName }, emailRedirectTo: undefined },
      });
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          return signInWithEmailOnly(email, password);
        }
        Alert.alert('Sign up failed', error.message);
        return false;
      }
      if (data.session?.user?.id) {
        await revenueCatLogIn(data.session.user.id);
        return true;
      }
      Alert.alert(
        'Confirm your email',
        'We sent you a confirmation link. Open it to activate your account, then come back and sign in.'
      );
      return false;
    } catch (e) {
      Alert.alert('Sign up failed', (e as Error).message);
      return false;
    }
  }

  return {
    signInWithApple: linkWithApple,
    signInWithGoogle: linkWithGoogle,
    signInWithEmail: linkWithEmail,
    signInWithEmailOnly,
    linkWithApple,
    linkWithGoogle,
    linkWithEmail,
  };
}
