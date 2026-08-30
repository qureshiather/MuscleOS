import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getOutbox, clearOutbox, setOutbox, enqueueOutbox } from './outbox';
import { getSyncMeta, setSyncMeta } from './meta';
import { useSyncStore } from '@/store/syncStore';
import { applyRemoteRecords, collectFullLocalSnapshot, reloadSyncedStores } from './merge';
import {
  applyRemoteUserExercises,
  isCustomExerciseOutbox,
  pullUserExercises,
  pushUserExercises,
} from './userExercises';
import type { OutboxEntry, RemoteSyncRecord } from './types';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;

export function isCloudSyncEnabled(): boolean {
  const { user, isAnonymous } = useAuthStore.getState();
  return isSupabaseConfigured() && !!user && !isAnonymous;
}

export function schedulePush(delayMs = 2000): void {
  if (!isCloudSyncEnabled()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, delayMs);
}

export async function pushNow(): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const outbox = await getOutbox();
  if (outbox.length === 0) return;

  const customEntries = outbox.filter(isCustomExerciseOutbox);
  const syncEntries = outbox.filter((entry) => !isCustomExerciseOutbox(entry));

  if (customEntries.length) {
    await pushUserExercises(customEntries);
  }

  if (syncEntries.length === 0) {
    await clearOutbox();
    await setSyncMeta({ lastPushedAt: new Date().toISOString() });
    return;
  }

  const records = syncEntries.map((entry) => ({
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    payload: entry.op === 'delete' ? null : entry.payload ?? null,
    updated_at: entry.updatedAt,
    deleted_at: entry.op === 'delete' ? entry.updatedAt : null,
  }));

  const { error } = await supabase.rpc('upsert_sync_records', { records });

  if (error) {
    // Fallback for projects that have not applied the LWW RPC migration yet.
    if (error.message?.includes('upsert_sync_records') || error.code === 'PGRST202') {
      const userId = useAuthStore.getState().user!.id;
      const rows = records.map((r) => ({ ...r, user_id: userId }));
      const { error: upsertError } = await supabase.from('sync_records').upsert(rows, {
        onConflict: 'user_id,entity_type,entity_id',
      });
      if (upsertError) {
        if (__DEV__) console.warn('[sync] push failed:', upsertError.message);
        throw new Error(upsertError.message);
      }
    } else {
      if (__DEV__) console.warn('[sync] push failed:', error.message);
      throw new Error(error.message);
    }
  }

  await clearOutbox();
  await setSyncMeta({ lastPushedAt: new Date().toISOString() });
}

export async function pullNow(): Promise<boolean> {
  if (!isCloudSyncEnabled()) return false;

  const meta = await getSyncMeta();
  let query = supabase.from('sync_records').select('*');

  if (meta.lastPulledAt) {
    query = query.gt('updated_at', meta.lastPulledAt);
  }

  const [{ data, error }, userRows] = await Promise.all([
    query.order('updated_at', { ascending: true }),
    pullUserExercises(meta.lastPulledAt),
  ]);

  if (error) {
    if (__DEV__) console.warn('[sync] pull failed:', error.message);
    throw new Error(error.message);
  }

  const records = (data ?? []) as RemoteSyncRecord[];
  const appliedRecords = records.length ? await applyRemoteRecords(records) : false;
  const appliedUsers = await applyRemoteUserExercises(userRows);

  if (!appliedRecords && !appliedUsers && records.length === 0 && userRows.length === 0) {
    await setSyncMeta({ lastPulledAt: new Date().toISOString() });
    return false;
  }

  if (appliedRecords || appliedUsers) {
    await reloadSyncedStores();
  }
  await setSyncMeta({ lastPulledAt: new Date().toISOString() });
  return appliedRecords || appliedUsers;
}

/** Pull then push — Strong-style background sync. */
export async function syncNow(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  if (syncInFlight) return syncInFlight;

  useSyncStore.getState().setSyncing(true);

  syncInFlight = (async () => {
    try {
      await pullNow();
      await pushNow();
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

/** Upload all local data when user links their account. */
export async function onAccountLinked(): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const snapshot = await collectFullLocalSnapshot();
  const outbox: OutboxEntry[] = snapshot.map((item) => ({
    entityType: item.entityType,
    entityId: item.entityId,
    op: 'upsert' as const,
    payload: item.payload,
    updatedAt: item.updatedAt,
  }));

  await setOutbox(outbox);
  await syncNow();
}
