import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  '';
const supabaseAnonKey =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

const hasConfig = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

// Only create a real client when configured; otherwise use placeholders so
// createClient() doesn't throw and the app can start (auth is guarded by isSupabaseConfigured()).
export const supabase = createClient(
  hasConfig ? supabaseUrl : 'https://placeholder.supabase.co',
  hasConfig ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

// Refresh session when app comes to foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
