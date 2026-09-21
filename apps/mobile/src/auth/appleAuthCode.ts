import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/storage/keys';

/** Persist the one-time Apple authorization code until save-apple-token or delete-account uses it. */
export async function setAppleAuthorizationCode(code: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.appleAuthorizationCode, code);
}

export async function getAppleAuthorizationCode(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.appleAuthorizationCode);
}

export async function clearAppleAuthorizationCode(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.appleAuthorizationCode);
}
