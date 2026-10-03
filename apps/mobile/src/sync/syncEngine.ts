import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getOutbox, clearOutbox, setOutbox, enqueueOutboxMany, removeOutboxEntries, outboxEntryKey } from './outbox';
import { getSyncMeta, resetSyncMeta, setSyncMeta, syncOwnerAction } from './meta';
import { useSyncStore } from '@/store/syncStore';
import {
  applyRemoteRecords,
  collectFullLocalSnapshot,
  reloadSyncedStores,
  type SnapshotItem,
} from './merge';
import {
  applyRemoteUserExercises,
  isCustomExerciseOutbox,
  pullUserExercises,
  pushUserExercises,
} from './userExercises';
import type { OutboxEntry, RemoteSyncRecord } from './types';

/** Local mutations are batched into one push this long after the last one. */
export const PUSH_DEBOUNCE_MS = 2000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;

export function isCloudSyncEnabled(): boolean {
  const { user, isAnonymous } = useAuthStore.getState();
  return isSupabaseConfigured() && !!user && !isAnonymous;
}

export function schedulePush(delayMs = PUSH_DEBOUNCE_MS): void {
  if (!isCloudSyncEnabled()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow().catch((e) => {
      if (__DEV__) console.warn('[sync] scheduled push failed:', e);
    });
  }, delayMs);
}

/**
 * Split the outbox for one push: recovery entries are dropped (derived, never synced), custom
 * exercises go to `user_exercises`, everything else to `sync_records`.
 */
export function partitionOutbox(raw: OutboxEntry[]): {
  recovery: OutboxEntry[];
  custom: OutboxEntry[];
  records: OutboxEntry[];
} {
  const recovery: OutboxEntry[] = [];
  const custom: OutboxEntry[] = [];
  const records: OutboxEntry[] = [];
  for (const entry of raw) {
    if (entry.entityType === 'recovery') recovery.push(entry);
    else if (isCustomExerciseOutbox(entry)) custom.push(entry);
    else records.push(entry);
  }
  return { recovery, custom, records };
}

export type SyncRecordRow = {
  entity_type: OutboxEntry['entityType'];
  entity_id: string;
  payload: unknown | null;
  updated_at: string;
  deleted_at: string | null;
};

/** A delete is a tombstone: null payload and `deleted_at` = the entry's clock. */
export function outboxToSyncRecords(entries: OutboxEntry[]): SyncRecordRow[] {
  return entries.map((entry) => ({
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    payload: entry.op === 'delete' ? null : (entry.payload ?? null),
    updated_at: entry.updatedAt,
    deleted_at: entry.op === 'delete' ? entry.updatedAt : null,
  }));
}

/** The upsert RPC is missing on projects that haven't applied the LWW migration yet. */
export function isMissingUpsertRpc(error: { message?: string; code?: string }): boolean {
  return !!error.message?.includes('upsert_sync_records') || error.code === 'PGRST202';
}

/**
 * Make sure the outbox and watermark belong to the signed-in account. When the account changed,
 * the previous account's queued entries are dropped (never pushed into this one), the next pull is
 * a full one, and the device's local rows are uploaded to the new account after that pull.
 */
export async function ensureSyncOwner(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  const meta = await getSyncMeta();
  const action = syncOwnerAction(meta, userId);
  if (action === 'adopt') {
    await setSyncMeta({ userId });
  } else if (action === 'reset') {
    await clearOutbox();
    await resetSyncMeta(userId, true);
  }
}

/** Sign-out: the new guest starts with an empty transport (guests never sync). */
export async function resetSyncTransport(userId: string | null): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await clearOutbox();
  await resetSyncMeta(userId);
}

export async function pushNow(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  await ensureSyncOwner();

  const { recovery, custom, records } = partitionOutbox(await getOutbox());
  if (recovery.length) await removeOutboxEntries(recovery);
  if (custom.length === 0 && records.length === 0) return;

  if (custom.length) {
    await pushUserExercises(custom);
    await removeOutboxEntries(custom);
  }

  if (records.length) {
    const rows = outboxToSyncRecords(records);
    const { error } = await supabase.rpc('upsert_sync_records', { records: rows });
    if (error) {
      if (!isMissingUpsertRpc(error)) {
        if (__DEV__) console.warn('[sync] push failed:', error.message);
        throw new Error(error.message);
      }
      // Fallback for projects without the LWW RPC: a plain upsert (no server-side clock check).
      const userId = useAuthStore.getState().user!.id;
      const { error: upsertError } = await supabase
        .from('sync_records')
        .upsert(
          rows.map((r) => ({ ...r, user_id: userId })),
          { onConflict: 'user_id,entity_type,entity_id' }
        );
      if (upsertError) {
        if (__DEV__) console.warn('[sync] push failed:', upsertError.message);
        throw new Error(upsertError.message);
      }
    }
    // Only what was sent: anything queued during the request stays for the next push.
    await removeOutboxEntries(records);
  }

  await setSyncMeta({ lastPushedAt: new Date().toISOString() });
}

type PullResult = { changed: boolean; remoteKeys: Set<string> };

async function pullRemote(options: { full?: boolean } = {}): Promise<PullResult> {
  const meta = await getSyncMeta();
  const since = options.full ? null : meta.lastPulledAt;
  let query = supabase.from('sync_records').select('*');
  if (since) query = query.gt('updated_at', since);

  const [{ data, error }, userRows] = await Promise.all([
    query.order('updated_at', { ascending: true }),
    pullUserExercises(since),
  ]);

  if (error) {
    if (__DEV__) console.warn('[sync] pull failed:', error.message);
    throw new Error(error.message);
  }

  const records = (data ?? []) as RemoteSyncRecord[];
  const appliedRecords = records.length ? await applyRemoteRecords(records) : false;
  const appliedUsers = await applyRemoteUserExercises(userRows);
  const changed = appliedRecords || appliedUsers;
  if (changed) await reloadSyncedStores();
  await setSyncMeta({ lastPulledAt: new Date().toISOString() });

  const remoteKeys = new Set<string>([
    ...records.map((r) => outboxEntryKey(r.entity_type, r.entity_id)),
    ...userRows.map((r) => outboxEntryKey('custom_exercise', r.id)),
  ]);
  return { changed, remoteKeys };
}

/** Pull rows newer than the watermark (`lastPulledAt`) and merge them. True if anything changed. */
export async function pullNow(): Promise<boolean> {
  if (!isCloudSyncEnabled()) return false;
  await ensureSyncOwner();
  return (await pullRemote()).changed;
}

/**
 * After a full pull into a different account: the local rows that account doesn't have, as
 * outbox upserts. Rows the account already has were merged by the pull (remote wins for
 * snapshots — notes, previous, settings — because nothing local is pending).
 */
export function localUploadEntries(items: SnapshotItem[], remoteKeys: ReadonlySet<string>): OutboxEntry[] {
  return items
    .filter((item) => !remoteKeys.has(outboxEntryKey(item.entityType, item.entityId)))
    .map((item) => ({
      entityType: item.entityType,
      entityId: item.entityId,
      op: 'upsert' as const,
      payload: item.payload,
      updatedAt: item.updatedAt,
    }));
}

async function runSync(): Promise<void> {
  await ensureSyncOwner();
  const { pendingLocalUpload } = await getSyncMeta();
  const { remoteKeys } = await pullRemote({ full: !!pendingLocalUpload });
  if (pendingLocalUpload) {
    await enqueueOutboxMany(localUploadEntries(await collectFullLocalSnapshot(), remoteKeys));
    await setSyncMeta({ pendingLocalUpload: false });
  }
  await pushNow();
}

/** Pull then push — Strong-style background sync. Failures land in `useSyncStore().lastError`. */
export async function syncNow(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  if (syncInFlight) return syncInFlight;

  useSyncStore.getState().setSyncing(true);

  syncInFlight = (async () => {
    try {
      await runSync();
      const now = new Date().toISOString();
      await setSyncMeta({ lastSyncedAt: now });
      useSyncStore.getState().setSynced(now);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed';
      if (__DEV__) console.warn('[sync] syncNow error:', e);
      useSyncStore.getState().setError(message);
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

/** Immediate push after finishing a workout (Strong syncs on complete). */
export async function syncAfterWorkout(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  try {
    await pushNow();
    const now = new Date().toISOString();
    await setSyncMeta({ lastSyncedAt: now });
    useSyncStore.getState().setSynced(now);
  } catch {
    schedulePush(0);
  }
}

/** A guest upgraded in place (same user id): upload everything on the device, then sync. */
export async function onAccountLinked(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  await ensureSyncOwner();

  const snapshot = await collectFullLocalSnapshot();
  await setOutbox(localUploadEntries(snapshot, new Set()));
  await setSyncMeta({ pendingLocalUpload: false });
  await syncNow();
}
