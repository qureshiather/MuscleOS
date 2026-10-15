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

export type AnonymousGuestDeps<U extends AnonymousGuestUser = AnonymousGuestUser> = {
  signInAnonymously: () => Promise<{ user: U | null }>;
};

/** Wipe this device after the cloud account is gone. Auth session keys are cleared by signOut. */
export async function wipeDeviceAfterAccountDeletion(): Promise<void> {
  await clearAllData();
  await Promise.all([
    ...EXTRA_DELETION_KEYS.map((key) => AsyncStorage.removeItem(key)),
    clearAppleAuthorizationCode(),
  ]);
}

/** Start a new guest session. */
export async function startFreshAnonymousGuest<U extends AnonymousGuestUser>(
  deps: AnonymousGuestDeps<U>
): Promise<U | null> {
  const { user } = await deps.signInAnonymously();
  return user;
}

export type AccountDeletionResetDeps<U extends AnonymousGuestUser> = AnonymousGuestDeps<U> & {
  signOutGoogle: () => Promise<void>;
  signOutSupabase: () => Promise<unknown>;
  discardActiveWorkout: () => void | Promise<void>;
  wipeDevice: () => Promise<void>;
  resetSyncTransport: (userId: string | null) => Promise<void>;
};

/**
 * After the server has deleted the account, leave it on this device. The account is already gone,
 * so no step may fail the deletion or stop the ones after it: each is best-effort, and the caller
 * always ends up as a guest (null when anonymous sign-in failed — a local-only guest).
 */
export async function resetDeviceAfterAccountDeletion<U extends AnonymousGuestUser>(
  deps: AccountDeletionResetDeps<U>
): Promise<U | null> {
  await bestEffort(deps.signOutGoogle);
  await bestEffort(deps.signOutSupabase);
  await bestEffort(async () => deps.discardActiveWorkout());
  await bestEffort(deps.wipeDevice);
  const user = (await bestEffort(() => startFreshAnonymousGuest(deps))) ?? null;
  await bestEffort(() => deps.resetSyncTransport(user?.id ?? null));
  return user;
}

async function bestEffort<T>(step: () => Promise<T>): Promise<T | undefined> {
  try {
    return await step();
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[account] post-deletion step failed', e);
    return undefined;
  }
}
