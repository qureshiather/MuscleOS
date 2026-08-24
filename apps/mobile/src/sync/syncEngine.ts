import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getOutbox, clearOutbox, setOutbox, enqueueOutbox } from './outbox';
import { getSyncMeta, setSyncMeta } from './meta';
import { applyRemoteRecords, collectFullLocalSnapshot, reloadSyncedStores } from './merge';
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

  const userId = useAuthStore.getState().user!.id;
  const outbox = await getOutbox();
  if (outbox.length === 0) return;

  const rows = outbox.map((entry) => ({
    user_id: userId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    payload: entry.op === 'delete' ? null : entry.payload ?? null,
    updated_at: entry.updatedAt,
    deleted_at: entry.op === 'delete' ? entry.updatedAt : null,
  }));

  const { error } = await supabase.from('sync_records').upsert(rows, {
    onConflict: 'user_id,entity_type,entity_id',
  });

  if (error) {
    if (__DEV__) console.warn('[sync] push failed:', error.message);
    throw new Error(error.message);
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

  const { data, error } = await query.order('updated_at', { ascending: true });

  if (error) {
    if (__DEV__) console.warn('[sync] pull failed:', error.message);
    throw new Error(error.message);
  }

  const records = (data ?? []) as RemoteSyncRecord[];
  if (records.length === 0) {
    await setSyncMeta({ lastPulledAt: new Date().toISOString() });
    return false;
  }

  await applyRemoteRecords(records);
  await reloadSyncedStores();
  await setSyncMeta({ lastPulledAt: new Date().toISOString() });
  return true;
}

/** Pull then push — Strong-style background sync. */
export async function syncNow(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      await pullNow();
      await pushNow();
    } catch (e) {
      if (__DEV__) console.warn('[sync] syncNow error:', e);
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
