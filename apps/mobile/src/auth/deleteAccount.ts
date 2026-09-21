import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllData } from '@/storage/localStorage';
import { STORAGE_KEYS } from '@/storage/keys';
import { clearAppleAuthorizationCode } from '@/auth/appleAuthCode';

/**
 * Keys Clear all data leaves behind that still hold user intent or sync transport.
 * Account deletion wipes the device, so these go too.
 */
const EXTRA_DELETION_KEYS = [
  STORAGE_KEYS.activeWorkout,
  STORAGE_KEYS.syncOutbox,
  STORAGE_KEYS.syncMeta,
] as const;

export type AnonymousGuestUser = { id: string };

export type AnonymousGuestDeps = {
  signInAnonymously: () => Promise<{ user: AnonymousGuestUser | null }>;
  revenueCatLogOut: () => Promise<void>;
  revenueCatLogIn: (userId: string) => Promise<void>;
};

/** Wipe this device after the cloud account is gone. Auth session keys are cleared by signOut. */
export async function wipeDeviceAfterAccountDeletion(): Promise<void> {
  await clearAllData();
  await Promise.all([
    ...EXTRA_DELETION_KEYS.map((key) => AsyncStorage.removeItem(key)),
    clearAppleAuthorizationCode(),
  ]);
}

/** Start a new guest session and re-point RevenueCat at it. */
export async function startFreshAnonymousGuest(
  deps: AnonymousGuestDeps
): Promise<AnonymousGuestUser | null> {
  const { user } = await deps.signInAnonymously();
  if (user?.id) {
    await deps.revenueCatLogOut();
    await deps.revenueCatLogIn(user.id);
  }
  return user;
}
