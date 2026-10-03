import type { Exercise } from '@muscleos/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { getCustomExercises, getRetiredCustomExercises, setCustomExercises } from '@/storage/localStorage';

/**
 * Custom exercise sync (docs/features/exercise-library.md#storage-and-privacy): notifications only
 * when cloud sync is on, soft-delete tombstones, and applying remote rows.
 */

const engine = vi.hoisted(() => ({ enabled: false, schedulePush: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: () => false }));
vi.mock('./syncEngine', () => ({
  isCloudSyncEnabled: () => engine.enabled,
  schedulePush: engine.schedulePush,
}));

import { notifyCustomExerciseDelete, notifyCustomExerciseUpsert } from './notify';
import { getOutbox, setOutbox } from './outbox';
import {
  applyRemoteUserExercises,
  customOutboxToUserRecord,
  type RemoteUserExercise,
} from './userExercises';

const custom: Exercise = {
  id: 'custom_1',
  name: 'Band Pull-Apart',
  muscles: ['rear_delts'],
  equipment: ['band'],
  category: 'cable',
  trackingType: 'weight_reps',
  isPublished: true,
};

function remote(extra: Partial<RemoteUserExercise> = {}): RemoteUserExercise {
  return {
    id: 'custom_1',
    name: 'Remote Name',
    instructions: null,
    category: 'cable',
    muscles: ['rear_delts'],
    equipment: ['band'],
    tracking_type: 'weight_reps',
    updated_at: '2026-10-03T00:00:00.000Z',
    deleted_at: null,
    ...extra,
  };
}

beforeEach(() => {
  __resetAsyncStorage();
  engine.enabled = false;
  engine.schedulePush.mockClear();
});

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('custom exercise notifications', () => {
  it('skips the outbox entirely when cloud sync is off (anonymous / signed out)', async () => {
    notifyCustomExerciseUpsert(custom);
    notifyCustomExerciseDelete('custom_1');
    await flush();
    expect(await getOutbox()).toEqual([]);
    expect(engine.schedulePush).not.toHaveBeenCalled();
  });

  it('queues an upsert and schedules a push when sync is on', async () => {
    engine.enabled = true;
    notifyCustomExerciseUpsert(custom);
    await flush();
    expect(await getOutbox()).toEqual([
      expect.objectContaining({ entityType: 'custom_exercise', entityId: 'custom_1', op: 'upsert', payload: custom }),
    ]);
    expect(engine.schedulePush).toHaveBeenCalled();
  });

  it('replaces a pending upsert with a delete for the same id', async () => {
    engine.enabled = true;
    notifyCustomExerciseUpsert(custom);
    await flush();
    notifyCustomExerciseDelete('custom_1');
    await flush();
    expect(await getOutbox()).toEqual([
      expect.objectContaining({ entityId: 'custom_1', op: 'delete' }),
    ]);
  });
});

describe('customOutboxToUserRecord', () => {
  it('maps an upsert to a user_exercises row', () => {
    expect(
      customOutboxToUserRecord({
        entityType: 'custom_exercise',
        entityId: 'custom_1',
        op: 'upsert',
        payload: { ...custom, instructions: 'Squeeze.' },
        updatedAt: '2026-10-03T00:00:00.000Z',
      })
    ).toEqual({
      id: 'custom_1',
      name: 'Band Pull-Apart',
      instructions: 'Squeeze.',
      category: 'cable',
      muscles: ['rear_delts'],
      equipment: ['band'],
      tracking_type: 'weight_reps',
      updated_at: '2026-10-03T00:00:00.000Z',
      deleted_at: null,
    });
  });

  it('maps a delete to a soft tombstone (deleted_at = updated_at)', () => {
    const row = customOutboxToUserRecord({
      entityType: 'custom_exercise',
      entityId: 'custom_1',
      op: 'delete',
      updatedAt: '2026-10-03T00:00:00.000Z',
    });
    expect(row).toMatchObject({
      id: 'custom_1',
      updated_at: '2026-10-03T00:00:00.000Z',
      deleted_at: '2026-10-03T00:00:00.000Z',
    });
  });
});

describe('applyRemoteUserExercises', () => {
  it('adds remote customs that are not local', async () => {
    expect(await applyRemoteUserExercises([remote()])).toBe(true);
    expect((await getCustomExercises()).map((e) => e.name)).toEqual(['Remote Name']);
  });

  it('takes remote over a clean local copy', async () => {
    await setCustomExercises([custom]);
    expect(await applyRemoteUserExercises([remote()])).toBe(true);
    expect((await getCustomExercises())[0].name).toBe('Remote Name');
  });

  it('applies a remote tombstone by removing the local custom and retiring it for history', async () => {
    await setCustomExercises([custom]);
    expect(await applyRemoteUserExercises([remote({ deleted_at: '2026-10-03T00:00:00.000Z' })])).toBe(true);
    expect(await getCustomExercises()).toEqual([]);
    expect((await getRetiredCustomExercises()).map((e) => [e.id, e.name])).toEqual([['custom_1', 'Band Pull-Apart']]);
  });

  it('retires nothing for a tombstone of a custom this device never had', async () => {
    expect(await applyRemoteUserExercises([remote({ deleted_at: '2026-10-03T00:00:00.000Z' })])).toBe(false);
    expect(await getRetiredCustomExercises()).toEqual([]);
  });

  it('keeps a locally edited (dirty) custom over a remote change', async () => {
    await setCustomExercises([custom]);
    await setOutbox([
      {
        entityType: 'custom_exercise',
        entityId: 'custom_1',
        op: 'upsert',
        payload: custom,
        updatedAt: '2026-10-04T00:00:00.000Z',
      },
    ]);
    expect(await applyRemoteUserExercises([remote()])).toBe(false);
    expect((await getCustomExercises())[0].name).toBe('Band Pull-Apart');
  });

  it('returns false for no rows', async () => {
    expect(await applyRemoteUserExercises([])).toBe(false);
  });
});
