import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/storage/keys';
import type { SyncMeta } from './types';

const DEFAULT_META: SyncMeta = { userId: null, lastPulledAt: null, lastPushedAt: null, lastSyncedAt: null };

export function latestSyncTime(
  meta: Pick<SyncMeta, 'lastSyncedAt' | 'lastPushedAt' | 'lastPulledAt'>
): string | null {
  return meta.lastSyncedAt ?? meta.lastPushedAt ?? meta.lastPulledAt;
}

export function parseSyncMeta(raw: string | null): SyncMeta {
  if (!raw) return { ...DEFAULT_META };
  try {
    const parsed = JSON.parse(raw) as Partial<SyncMeta> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
  }
}

export async function getSyncMeta(): Promise<SyncMeta> {
  return parseSyncMeta(await AsyncStorage.getItem(STORAGE_KEYS.syncMeta));
}

export async function setSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  const current = await getSyncMeta();
  await AsyncStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ ...current, ...patch }));
}

/** Start the transport over for `userId`: no watermark (the next pull is full) and no sync times. */
export async function resetSyncMeta(userId: string | null, pendingLocalUpload = false): Promise<void> {
  const meta: SyncMeta = { ...DEFAULT_META, userId, ...(pendingLocalUpload ? { pendingLocalUpload } : {}) };
  await AsyncStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify(meta));
}

/**
 * What to do with the sync transport for the signed-in `currentUserId`:
 * - `adopt`: the meta predates owner tracking (it has synced before) — keep the outbox and
 *   watermark, record the owner
 * - `keep`: same account
 * - `claim`: a device that has never synced (a first-launch guest signing in) — record the owner and
 *   upload the device's data after a full pull, keeping anything already queued
 * - `reset`: a different account — its pending entries and watermark must not leak into this one
 */
export function syncOwnerAction(
  meta: SyncMeta,
  currentUserId: string
): 'adopt' | 'claim' | 'keep' | 'reset' {
  if (meta.userId == null) {
    const neverSynced = meta.lastPulledAt == null && meta.lastPushedAt == null && meta.pullCursor == null;
    return neverSynced ? 'claim' : 'adopt';
  }
  return meta.userId === currentUserId ? 'keep' : 'reset';
}
