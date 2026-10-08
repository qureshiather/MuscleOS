import { supabase } from '@/lib/supabase';
import type { Exercise } from '@muscleos/types';
import {
  getCustomExercises,
  getRetiredCustomExercises,
  setCustomExercises,
  setRetiredCustomExercises,
} from '@/storage/localStorage';
import { catalogRowToExercise, exerciseToUserRow, normalizeExercise } from '@/utils/exerciseNormalize';
import { retireExercise } from '@/utils/exerciseIds';
import { commitOutboxEdits, getOutboxMap, outboxEntryKey } from './outbox';
import { bumpUpdatedAtIfNeeded, decideEntityApply } from './mergePolicy';
import { isMissingServerClock } from './pullWatermark';
import type { OutboxEntry } from './types';

export interface RemoteUserExercise {
  id: string;
  name: string;
  instructions: string | null;
  category: string;
  muscles: string[];
  equipment: string[];
  updated_at: string;
  /** Stamped by the database on every write; absent before the MUS-91 migration. */
  server_updated_at?: string;
  deleted_at: string | null;
}

export function isCustomExerciseOutbox(entry: OutboxEntry): boolean {
  return entry.entityType === 'custom_exercise';
}

export function customOutboxToUserRecord(entry: OutboxEntry): Record<string, unknown> {
  if (entry.op === 'delete') {
    return {
      id: entry.entityId,
      name: entry.entityId,
      instructions: null,
      category: 'free_weight',
      muscles: ['chest'],
      equipment: [],
      updated_at: entry.updatedAt,
      deleted_at: entry.updatedAt,
    };
  }
  const exercise = normalizeExercise(entry.payload, entry.entityId);
  return exerciseToUserRow(exercise, entry.updatedAt, null);
}

export async function pushUserExercises(entries: OutboxEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const records = entries.map(customOutboxToUserRecord);
  const { error } = await supabase.rpc('upsert_user_exercises', { records });
  if (error) {
    if (__DEV__) console.warn('[sync] user_exercises push failed:', error.message);
    throw new Error(error.message);
  }
}

/** `since` is a server-clock bound (`server_updated_at`); null pulls everything. */
export async function pullUserExercises(since: string | null): Promise<RemoteUserExercise[]> {
  let query = supabase.from('user_exercises').select('*');
  if (since) query = query.gt('server_updated_at', since);
  let { data, error } = await query.order('server_updated_at', { ascending: true });
  if (error && isMissingServerClock(error)) {
    // The MUS-91 migration isn't applied yet: fall back to a full pull, which can't miss rows.
    ({ data, error } = await supabase.from('user_exercises').select('*').order('updated_at', { ascending: true }));
  }
  if (error) {
    if (__DEV__) console.warn('[sync] user_exercises pull failed:', error.message);
    if (error.code === 'PGRST205' || error.message?.includes('user_exercises')) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as RemoteUserExercise[];
}

export async function applyRemoteUserExercises(rows: RemoteUserExercise[]): Promise<boolean> {
  if (rows.length === 0) return false;

  const [customExercises, outboxMap] = await Promise.all([getCustomExercises(), getOutboxMap()]);
  const outboxBefore = Array.from(outboxMap.values());
  const exerciseMap = new Map(customExercises.map((e) => [e.id, e]));
  const retiredByTombstone: Exercise[] = [];
  let changed = false;

  for (const row of rows) {
    const pending = outboxMap.get(outboxEntryKey('custom_exercise', row.id));
    const isDirty = !!pending;
    const local = exerciseMap.get(row.id);

    if (row.deleted_at) {
      const decision = decideEntityApply({
        hasLocal: !!local,
        isDirty,
        localUpdatedAt: pending?.updatedAt ?? null,
        remoteUpdatedAt: row.updated_at,
      });
      if (decision === 'take_remote') {
        if (local) retiredByTombstone.push(local);
        if (exerciseMap.delete(row.id)) changed = true;
      } else if (pending) {
        const updatedAt = bumpUpdatedAtIfNeeded(pending.updatedAt, row.updated_at);
        outboxMap.set(outboxEntryKey(pending.entityType, pending.entityId), {
          ...pending,
          updatedAt,
        });
      }
      continue;
    }

    const remote: Exercise = catalogRowToExercise(row as unknown as Record<string, unknown>);
    const decision = decideEntityApply({
      hasLocal: !!local,
      isDirty,
      localUpdatedAt: pending?.updatedAt ?? null,
      remoteUpdatedAt: row.updated_at,
    });
    if (decision === 'take_remote') {
      exerciseMap.set(row.id, remote);
      changed = true;
    } else if (pending) {
      const updatedAt = bumpUpdatedAtIfNeeded(pending.updatedAt, row.updated_at);
      outboxMap.set(outboxEntryKey(pending.entityType, pending.entityId), {
        ...pending,
        updatedAt,
        payload: local ?? pending.payload,
      });
    }
  }

  if (changed) {
    await setCustomExercises(Array.from(exerciseMap.values()));
  }
  if (retiredByTombstone.length > 0) {
    // Deleted on another device: keep resolving it for this device's history, like a local delete.
    const retired = retiredByTombstone.reduce(retireExercise, await getRetiredCustomExercises());
    await setRetiredCustomExercises(retired);
  }
  await commitOutboxEdits(outboxBefore, Array.from(outboxMap.values()));
  return changed;
}
