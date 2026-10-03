import type { Exercise, WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseModule from '@/lib/supabase';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import type { FakeSupabase } from '@/test/mocks/fakeSupabase';
import { STORAGE_KEYS } from '@/storage/keys';
import {
  getAppSettings,
  getExerciseNotes,
  getSessions,
  getTemplates,
  setAppSettings,
  defaultAppSettings,
  setCustomExercises,
  setExerciseNotes,
  setSessions,
  setTemplates,
} from '@/storage/localStorage';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { enqueueOutbox, getOutbox, setOutbox } from './outbox';
import { getSyncMeta, latestSyncTime, parseSyncMeta, setSyncMeta, syncOwnerAction } from './meta';
import {
  ensureSyncOwner,
  isCloudSyncEnabled,
  isMissingUpsertRpc,
  localUploadEntries,
  onAccountLinked,
  outboxToSyncRecords,
  partitionOutbox,
  pullNow,
  pushNow,
  PUSH_DEBOUNCE_MS,
  resetSyncTransport,
  schedulePush,
  syncAfterWorkout,
  syncNow,
} from './syncEngine';
import { reloadSyncedStores } from './merge';
import * as notify from './notify';
import type { OutboxEntry } from './types';

/**
 * docs/features/accounts-and-data.md#cloud-sync — the push/pull engine against an in-memory
 * Supabase (src/test/mocks/fakeSupabase.ts) and the AsyncStorage harness.
 */

vi.stubGlobal('__DEV__', false);

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('@/test/mocks/fakeSupabase');
  const fake = createFakeSupabase();
  const state = { configured: true };
  return {
    supabase: fake.client,
    isSupabaseConfigured: () => state.configured,
    __fake: fake,
    __state: state,
  };
});
vi.mock('@/store/authStore', async () => {
  const { create } = await import('zustand');
  return {
    useAuthStore: create<{ user: { id: string } | null; isAnonymous: boolean }>(() => ({
      user: null,
      isAnonymous: true,
    })),
  };
});
vi.mock('./merge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./merge')>()),
  reloadSyncedStores: vi.fn(async () => undefined),
}));

const fake = (supabaseModule as unknown as { __fake: FakeSupabase }).__fake;
const supabaseState = (supabaseModule as unknown as { __state: { configured: boolean } }).__state;

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-02T10:00:00.000Z';
const NOW = '2026-03-01T12:00:00.000Z';

function signIn(id: string, isAnonymous = false) {
  useAuthStore.setState({ user: { id } as never, isAnonymous });
}

const session = (id: string, completedAt = T1): WorkoutSession => ({
  id,
  templateId: 'ppl-push',
  startedAt: T1,
  completedAt,
  exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
});
const template = (id: string, name = id): WorkoutTemplate => ({ id, name, exerciseIds: [] });
const custom = (id: string): Exercise =>
  ({ id, name: `Custom ${id}`, muscles: ['chest'], equipment: [], category: 'free_weight' }) as unknown as Exercise;
const upsert = (entityType: OutboxEntry['entityType'], entityId: string, payload: unknown = {}): OutboxEntry => ({
  entityType,
  entityId,
  op: 'upsert',
  payload,
  updatedAt: T1,
});
const remoteRow = (entity_type: string, entity_id: string, payload: unknown, updated_at = T2) => ({
  user_id: 'user-a',
  entity_type,
  entity_id,
  payload,
  updated_at,
  deleted_at: null,
});

beforeEach(() => {
  __resetAsyncStorage();
  fake.reset();
  supabaseState.configured = true;
  useAuthStore.setState({ user: null, isAnonymous: true });
  useSyncStore.setState({ isSyncing: false, lastError: null, lastSyncedAt: null });
  vi.mocked(reloadSyncedStores).mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isCloudSyncEnabled', () => {
  it('needs Supabase configured and a linked, non-anonymous user', () => {
    expect(isCloudSyncEnabled()).toBe(false);
    signIn('guest', true);
    expect(isCloudSyncEnabled()).toBe(false);
    signIn('user-a');
    expect(isCloudSyncEnabled()).toBe(true);
    supabaseState.configured = false;
    expect(isCloudSyncEnabled()).toBe(false);
  });
});

describe('pure helpers', () => {
  it('partitionOutbox splits recovery, custom exercises and sync records', () => {
    const parts = partitionOutbox([
      upsert('recovery', 'default'),
      upsert('custom_exercise', 'c1'),
      upsert('session', 's1'),
      upsert('app_settings', 'default'),
    ]);
    expect(parts.recovery.map((e) => e.entityId)).toEqual(['default']);
    expect(parts.custom.map((e) => e.entityId)).toEqual(['c1']);
    expect(parts.records.map((e) => e.entityType)).toEqual(['session', 'app_settings']);
  });

  it('outboxToSyncRecords sends deletes as tombstones', () => {
    expect(
      outboxToSyncRecords([
        upsert('template', 't1', { id: 't1' }),
        { entityType: 'template', entityId: 't2', op: 'delete', updatedAt: T2 },
      ])
    ).toEqual([
      { entity_type: 'template', entity_id: 't1', payload: { id: 't1' }, updated_at: T1, deleted_at: null },
      { entity_type: 'template', entity_id: 't2', payload: null, updated_at: T2, deleted_at: T2 },
    ]);
  });

  it('recognises a missing upsert RPC by message or PostgREST code', () => {
    expect(isMissingUpsertRpc({ message: 'Could not find the function public.upsert_sync_records' })).toBe(true);
    expect(isMissingUpsertRpc({ message: 'x', code: 'PGRST202' })).toBe(true);
    expect(isMissingUpsertRpc({ message: 'permission denied' })).toBe(false);
  });

  it('latestSyncTime prefers synced, then pushed, then pulled', () => {
    expect(latestSyncTime({ lastSyncedAt: 'c', lastPushedAt: 'b', lastPulledAt: 'a' })).toBe('c');
    expect(latestSyncTime({ lastSyncedAt: null, lastPushedAt: 'b', lastPulledAt: 'a' })).toBe('b');
    expect(latestSyncTime({ lastSyncedAt: null, lastPushedAt: null, lastPulledAt: 'a' })).toBe('a');
    expect(latestSyncTime({ lastSyncedAt: null, lastPushedAt: null, lastPulledAt: null })).toBeNull();
  });

  it('parseSyncMeta defaults missing and corrupt metas', () => {
    expect(parseSyncMeta(null)).toEqual({ userId: null, lastPulledAt: null, lastPushedAt: null, lastSyncedAt: null });
    expect(parseSyncMeta('nope').lastPulledAt).toBeNull();
    expect(parseSyncMeta('{"lastPulledAt":"x"}')).toMatchObject({ userId: null, lastPulledAt: 'x' });
  });

  it('syncOwnerAction adopts an untracked meta, keeps the same account, resets a different one', () => {
    const meta = parseSyncMeta(null);
    expect(syncOwnerAction(meta, 'a')).toBe('adopt');
    expect(syncOwnerAction({ ...meta, userId: 'a' }, 'a')).toBe('keep');
    expect(syncOwnerAction({ ...meta, userId: 'a' }, 'b')).toBe('reset');
  });

  it('localUploadEntries keeps only rows the remote does not have', () => {
    const entries = localUploadEntries(
      [
        { entityType: 'session', entityId: 's1', payload: {}, updatedAt: T1 },
        { entityType: 'session', entityId: 's2', payload: {}, updatedAt: T1 },
        { entityType: 'app_settings', entityId: 'default', payload: {}, updatedAt: T1 },
      ],
      new Set(['session:s1', 'app_settings:default'])
    );
    expect(entries).toEqual([{ entityType: 'session', entityId: 's2', op: 'upsert', payload: {}, updatedAt: T1 }]);
  });
});

describe('notify* (local mutation → outbox)', () => {
  it('no-ops for a guest', async () => {
    signIn('guest', true);
    notify.notifySessionUpsert(session('s1'));
    notify.notifyTemplateDelete('t1');
    notify.notifyAppSettingsSnapshot(defaultAppSettings());
    expect(await getOutbox()).toEqual([]);
  });

  it('queues upserts and deletes for a linked account; sessions keep their own clock', async () => {
    signIn('user-a');
    notify.notifySessionUpsert(session('s1', T2));
    notify.notifySessionDelete('s0');
    notify.notifyTemplateUpsert(template('t1'));
    notify.notifyFolderDelete('f1');
    notify.notifyCustomExerciseUpsert(custom('c1'));
    notify.notifyExerciseNotesSnapshot({ 'bench-press': 'Seat 4' });
    const outbox = await getOutbox();
    expect(outbox.map((e) => `${e.entityType}:${e.entityId}:${e.op}`)).toEqual([
      'session:s1:upsert',
      'session:s0:delete',
      'template:t1:upsert',
      'template_folder:f1:delete',
      'custom_exercise:c1:upsert',
      'exercise_note:default:upsert',
    ]);
    expect(outbox[0].updatedAt).toBe(T2);
    expect(outbox[1].updatedAt).toBe(NOW);
  });
});

describe('schedulePush', () => {
  it('debounces local mutations into one push 2 s after the last one', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    signIn('user-a');
    expect(PUSH_DEBOUNCE_MS).toBe(2000);
    await enqueueOutbox(upsert('session', 's1', session('s1')));
    schedulePush();
    await vi.advanceTimersByTimeAsync(1500);
    schedulePush();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fake.calls.rpc).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    // The timer only starts the push; let its storage reads settle.
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.calls.rpc).toHaveLength(1);
  });

  it('does nothing for a guest', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    signIn('guest', true);
    schedulePush(0);
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.calls.rpc).toHaveLength(0);
  });
});

describe('pushNow', () => {
  it('drops queued recovery, sends customs to user_exercises and the rest to sync_records', async () => {
    signIn('user-a');
    await setOutbox([
      upsert('recovery', 'default', []),
      upsert('custom_exercise', 'c1', custom('c1')),
      upsert('session', 's1', session('s1')),
    ]);
    await pushNow();
    expect(fake.calls.rpc.map((c) => c.name)).toEqual(['upsert_user_exercises', 'upsert_sync_records']);
    expect(fake.calls.rpc[1].args.records.map((r) => r.entity_type)).toEqual(['session']);
    expect(await getOutbox()).toEqual([]);
    expect((await getSyncMeta()).lastPushedAt).toBe(NOW);
  });

  it('an outbox of only recovery is cleared without a request', async () => {
    signIn('user-a');
    await setOutbox([upsert('recovery', 'default', [])]);
    await pushNow();
    expect(fake.calls.rpc).toHaveLength(0);
    expect(await getOutbox()).toEqual([]);
  });

  it('keeps entries queued while the request was in flight (H2)', async () => {
    signIn('user-a');
    await setOutbox([upsert('session', 's1', session('s1'))]);
    fake.hooks.duringRpc = () => enqueueOutbox(upsert('session', 's2', session('s2')));
    await pushNow();
    expect((await getOutbox()).map((e) => e.entityId)).toEqual(['s2']);
  });

  it('falls back to a plain upsert when the LWW RPC is missing', async () => {
    signIn('user-a');
    fake.failures.rpc.upsert_sync_records = { message: 'function upsert_sync_records not found', code: 'PGRST202' };
    await setOutbox([upsert('template', 't1', template('t1'))]);
    await pushNow();
    expect(fake.calls.upsert[0].table).toBe('sync_records');
    expect(fake.calls.upsert[0].rows[0]).toMatchObject({ user_id: 'user-a', entity_id: 't1' });
    expect(await getOutbox()).toEqual([]);
  });

  it('throws and keeps the outbox when the push fails', async () => {
    signIn('user-a');
    fake.failures.rpc.upsert_sync_records = { message: 'permission denied' };
    await setOutbox([upsert('template', 't1', template('t1'))]);
    await expect(pushNow()).rejects.toThrow('permission denied');
    expect(await getOutbox()).toHaveLength(1);
  });

  it('is a no-op for a guest', async () => {
    signIn('guest', true);
    await setOutbox([upsert('template', 't1', template('t1'))]);
    await pushNow();
    expect(fake.calls.rpc).toHaveLength(0);
  });
});

describe('pullNow and the watermark', () => {
  it('first pull is full, later pulls ask only for rows newer than lastPulledAt', async () => {
    signIn('user-a');
    fake.tables.sync_records.push(remoteRow('template', 't1', template('t1', 'Remote')));
    expect(await pullNow()).toBe(true);
    expect(fake.calls.select[0]).toEqual({ table: 'sync_records', since: null });
    expect((await getTemplates()).map((t) => t.name)).toEqual(['Remote']);
    expect(reloadSyncedStores).toHaveBeenCalledTimes(1);
    expect((await getSyncMeta()).lastPulledAt).toBe(NOW);

    expect(await pullNow()).toBe(false);
    expect(fake.calls.select.at(-1)).toEqual({ table: 'user_exercises', since: NOW });
    expect(fake.calls.select.filter((c) => c.table === 'sync_records').at(-1)?.since).toBe(NOW);
  });

  it('a missing user_exercises table is treated as no rows', async () => {
    signIn('user-a');
    fake.failures.select.user_exercises = { message: 'relation user_exercises does not exist', code: 'PGRST205' };
    await expect(pullNow()).resolves.toBe(false);
  });

  it('throws on a sync_records error', async () => {
    signIn('user-a');
    fake.failures.select.sync_records = { message: 'timeout' };
    await expect(pullNow()).rejects.toThrow('timeout');
  });
});

describe('syncNow', () => {
  it('pulls before it pushes, then records the sync time', async () => {
    signIn('user-a');
    await setOutbox([upsert('session', 's1', session('s1'))]);
    const order: string[] = [];
    const origFrom = fake.client.from;
    fake.client.from = (table: string) => {
      order.push(`pull:${table}`);
      return origFrom(table);
    };
    fake.hooks.duringRpc = async () => {
      order.push('push');
    };
    await syncNow();
    fake.client.from = origFrom;
    expect(order.indexOf('push')).toBeGreaterThan(order.indexOf('pull:sync_records'));
    expect(useSyncStore.getState()).toMatchObject({ isSyncing: false, lastError: null, lastSyncedAt: NOW });
    expect((await getSyncMeta()).lastSyncedAt).toBe(NOW);
  });

  it('a failure sets lastError and does not throw', async () => {
    signIn('user-a');
    fake.failures.select.sync_records = { message: 'Network request failed' };
    await expect(syncNow()).resolves.toBeUndefined();
    expect(useSyncStore.getState()).toMatchObject({ isSyncing: false, lastError: 'Network request failed' });
  });

  it('overlapping calls share one run', async () => {
    signIn('user-a');
    await Promise.all([syncNow(), syncNow()]);
    expect(fake.calls.select.filter((c) => c.table === 'sync_records')).toHaveLength(1);
  });

  it('does nothing for a guest', async () => {
    signIn('guest', true);
    await syncNow();
    expect(fake.calls.select).toHaveLength(0);
    expect(useSyncStore.getState().lastSyncedAt).toBeNull();
  });
});

describe('syncAfterWorkout', () => {
  it('pushes immediately and records the sync time', async () => {
    signIn('user-a');
    await setOutbox([upsert('session', 's1', session('s1'))]);
    await syncAfterWorkout();
    expect(fake.calls.rpc).toHaveLength(1);
    expect(useSyncStore.getState().lastSyncedAt).toBe(NOW);
  });
});

describe('changing accounts (H1)', () => {
  it('drops the previous account outbox and watermark when a different account signs in', async () => {
    await setSyncMeta({ userId: 'user-a', lastPulledAt: T2, lastSyncedAt: T2 });
    await setOutbox([upsert('template', 'a-only', template('a-only'))]);
    signIn('user-b');
    await ensureSyncOwner();
    expect(await getOutbox()).toEqual([]);
    expect(await getSyncMeta()).toMatchObject({ userId: 'user-b', lastPulledAt: null, pendingLocalUpload: true });
  });

  it('adopts a meta written before owners were tracked, keeping its outbox', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ lastPulledAt: T2 }));
    await setOutbox([upsert('template', 't1', template('t1'))]);
    signIn('user-a');
    await ensureSyncOwner();
    expect(await getOutbox()).toHaveLength(1);
    expect(await getSyncMeta()).toMatchObject({ userId: 'user-a', lastPulledAt: T2 });
  });

  it('never pushes the old account’s pending entries into the new one', async () => {
    await setSyncMeta({ userId: 'user-a', lastPulledAt: T2 });
    await setOutbox([upsert('template', 'a-only', template('a-only'))]);
    signIn('user-b');
    await syncNow();
    const pushedIds = fake.calls.rpc.flatMap((c) => c.args.records.map((r) => r.entity_id));
    expect(pushedIds).not.toContain('a-only');
  });

  it('resetSyncTransport (sign-out) empties the outbox and hands the meta to the new guest', async () => {
    await setSyncMeta({ userId: 'user-a', lastPulledAt: T2, lastSyncedAt: T2 });
    await setOutbox([upsert('template', 't1')]);
    await resetSyncTransport('guest-2');
    expect(await getOutbox()).toEqual([]);
    expect(await getSyncMeta()).toEqual({ userId: 'guest-2', lastPulledAt: null, lastPushedAt: null, lastSyncedAt: null });
  });
});

describe('signing into an existing account with guest data (D13)', () => {
  beforeEach(async () => {
    // A guest's device: its own workout, template, custom exercise, note and settings.
    await setSessions([session('guest-s1')]);
    await setTemplates([template('guest-t1')]);
    await setCustomExercises([custom('guest-c1')]);
    await setExerciseNotes({ squat: 'Guest note' });
    await setAppSettings({ ...defaultAppSettings(), weightUnit: 'lb' });
    await resetSyncTransport('guest-1');
    // The account already has a workout, notes and settings in the cloud.
    fake.tables.sync_records.push(
      remoteRow('session', 'acct-s1', session('acct-s1')),
      remoteRow('exercise_note', 'default', { bench: 'Account note' }),
      remoteRow('app_settings', 'default', { ...defaultAppSettings(), weightUnit: 'kg', profile: { age: 40 } })
    );
  });

  it('merges both ways: guest rows upload, the account’s rows come down, remote snapshots win', async () => {
    signIn('user-a');
    await syncNow();

    const pushed = fake.calls.rpc.flatMap((c) => c.args.records.map((r) => `${r.entity_type ?? 'custom'}:${r.entity_id ?? r.id}`));
    expect(pushed).toEqual(expect.arrayContaining(['session:guest-s1', 'template:guest-t1']));
    expect(fake.tables.user_exercises.map((r) => r.id)).toEqual(['guest-c1']);
    // Snapshots the account already had were taken from the cloud, not uploaded.
    expect(pushed).not.toContain('exercise_note:default');
    expect(pushed).not.toContain('app_settings:default');

    expect((await getSessions()).map((s) => s.id).sort()).toEqual(['acct-s1', 'guest-s1']);
    expect(await getExerciseNotes()).toEqual({ bench: 'Account note' });
    expect((await getAppSettings()).weightUnit).toBe('kg');
    expect((await getAppSettings()).profile).toEqual({ age: 40 });
    expect((await getSyncMeta()).pendingLocalUpload).toBe(false);
    expect(await getOutbox()).toEqual([]);
  });

  it('uploads the guest’s snapshots when the account has none (a brand-new account)', async () => {
    fake.tables.sync_records.length = 0;
    signIn('user-new');
    await syncNow();
    const pushed = fake.calls.rpc.flatMap((c) => c.args.records.map((r) => `${r.entity_type}:${r.entity_id}`));
    expect(pushed).toEqual(expect.arrayContaining(['exercise_note:default', 'app_settings:default']));
  });

  it('retries the upload on the next sync when the first one fails', async () => {
    signIn('user-a');
    fake.failures.select.sync_records = { message: 'offline' };
    await syncNow();
    expect((await getSyncMeta()).pendingLocalUpload).toBe(true);
    fake.failures.select = {};
    await syncNow();
    const pushed = fake.calls.rpc.flatMap((c) => c.args.records.map((r) => r.entity_id));
    expect(pushed).toContain('guest-s1');
    expect((await getSyncMeta()).pendingLocalUpload).toBe(false);
  });
});

describe('onAccountLinked (guest upgraded in place)', () => {
  it('uploads a full snapshot of the device, then syncs', async () => {
    await setSessions([session('s1')]);
    await setTemplates([template('t1')]);
    await setOutbox([upsert('recovery', 'default', [])]);
    signIn('guest-1');
    await onAccountLinked();
    const pushed = fake.calls.rpc
      .filter((c) => c.name === 'upsert_sync_records')
      .flatMap((c) => c.args.records.map((r) => `${r.entity_type}:${r.entity_id}`));
    expect(pushed).toEqual(expect.arrayContaining(['session:s1', 'template:t1', 'app_settings:default']));
    expect(pushed).not.toContain('recovery:default');
    expect(useSyncStore.getState().lastSyncedAt).toBe(NOW);
  });
});

describe('useSyncStore', () => {
  it('loadStatus shows the latest sync time from meta', async () => {
    await setSyncMeta({ lastPushedAt: T1, lastPulledAt: T2 });
    await useSyncStore.getState().loadStatus();
    expect(useSyncStore.getState().lastSyncedAt).toBe(T1);
  });

  it('starting a sync clears the previous error', () => {
    useSyncStore.getState().setError('x');
    useSyncStore.getState().setSyncing(true);
    expect(useSyncStore.getState().lastError).toBeNull();
  });
});
