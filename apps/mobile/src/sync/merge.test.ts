import type { WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getExerciseNotes,
  getExercisePrevious,
  getRecovery,
  getSessions,
  getTemplates,
  setExerciseNotes,
  setExercisePrevious,
  setRecovery,
  setSessions,
  setTemplates,
} from '@/storage/localStorage';
import { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { applyRemoteRecords, snapshotItems } from './merge';
import { getOutbox, setOutbox } from './outbox';
import type { RemoteSyncRecord, SyncEntityType } from './types';

/**
 * docs/features/accounts-and-data.md#conflict-resolution — the merge run against real reads and
 * writes through the in-memory AsyncStorage harness.
 */

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-02T10:00:00.000Z';
const T3 = '2026-01-03T10:00:00.000Z';

const session = (id: string, completedAt: string, weightKg = 60): WorkoutSession => ({
  id,
  templateId: 'ppl-push',
  startedAt: T1,
  completedAt,
  exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg, reps: 5 }] }],
});
const template = (id: string, name: string): WorkoutTemplate => ({ id, name, exerciseIds: [] });

const remote = (
  entity_type: SyncEntityType,
  entity_id: string,
  payload: unknown,
  updated_at: string,
  deleted_at: string | null = null
): RemoteSyncRecord => ({ user_id: 'u', entity_type, entity_id, payload, updated_at, deleted_at });

beforeEach(() => {
  __resetAsyncStorage();
});

describe('applyRemoteRecords', () => {
  it('takes remote rows that are missing locally', async () => {
    await applyRemoteRecords([remote('session', 's1', session('s1', T2), T2)]);
    expect((await getSessions()).map((s) => s.id)).toEqual(['s1']);
  });

  it('keeps a dirty local row over a newer remote and bumps its outbox clock', async () => {
    await setTemplates([template('tpl_1', 'Mine')]);
    await setOutbox([
      { entityType: 'template', entityId: 'tpl_1', op: 'upsert', payload: template('tpl_1', 'Mine'), updatedAt: T1 },
    ]);
    await applyRemoteRecords([remote('template', 'tpl_1', template('tpl_1', 'Theirs'), T2)]);

    expect((await getTemplates())[0]?.name).toBe('Mine');
    const [entry] = await getOutbox();
    expect(entry?.updatedAt > T2).toBe(true);
  });

  it('is last-write-wins for a clean session, by completedAt', async () => {
    await setSessions([session('s1', T2, 60)]);
    await applyRemoteRecords([remote('session', 's1', session('s1', T3, 80), T3)]);
    expect((await getSessions())[0]?.exercises[0]?.sets[0]?.weightKg).toBe(80);

    await setSessions([session('s2', T3, 60)]);
    await applyRemoteRecords([remote('session', 's2', session('s2', T2, 80), T2)]);
    expect((await getSessions()).find((s) => s.id === 's2')?.exercises[0]?.sets[0]?.weightKg).toBe(60);
  });

  it('lets a clean template, folder or custom exercise take the remote copy', async () => {
    await setTemplates([template('tpl_1', 'Old name')]);
    await applyRemoteRecords([remote('template', 'tpl_1', template('tpl_1', 'Renamed elsewhere'), T1)]);
    expect((await getTemplates())[0]?.name).toBe('Renamed elsewhere');
  });

  it('applies remote deletes to clean rows', async () => {
    await setSessions([session('s1', T1)]);
    await applyRemoteRecords([remote('session', 's1', null, T2, T2)]);
    expect(await getSessions()).toEqual([]);
  });

  it('keeps dirty map snapshots and fills their gaps from remote', async () => {
    await setExerciseNotes({ 'bench-press': 'pin 4' });
    await setOutbox([
      { entityType: 'exercise_note', entityId: 'default', op: 'upsert', payload: {}, updatedAt: T1 },
    ]);
    await applyRemoteRecords([
      remote('exercise_note', 'default', { 'bench-press': 'pin 5', squat: 'wide' }, T2),
    ]);
    expect(await getExerciseNotes()).toEqual({ 'bench-press': 'pin 4', squat: 'wide' });
  });

  it('replaces a clean map snapshot with the remote one', async () => {
    await setExercisePrevious({ 'bench-press': { weightKg: 60, reps: 5 } });
    await applyRemoteRecords([
      remote('exercise_previous', 'default', { squat: { weightKg: 100, reps: 5 } }, T2),
    ]);
    expect(await getExercisePrevious()).toEqual({ squat: { weightKg: 100, reps: 5 } });
  });

  it('never applies remote recovery; recomputes it from merged sessions', async () => {
    await setRecovery([{ muscleId: 'quads', trainedAt: T1 }]);
    await applyRemoteRecords([
      remote('recovery', 'default', [{ muscleId: 'calves', trainedAt: T3 }], T3),
      remote('session', 's1', session('s1', T2), T2),
    ]);
    const muscles = (await getRecovery()).map((r) => r.muscleId);
    expect(muscles).toContain('chest');
    expect(muscles).not.toContain('calves');
    expect(muscles).not.toContain('quads');
  });

  it('drops queued recovery pushes from the outbox', async () => {
    await setOutbox([
      { entityType: 'recovery', entityId: 'default', op: 'upsert', payload: [], updatedAt: T1 },
    ]);
    await applyRemoteRecords([remote('session', 's1', session('s1', T2), T2)]);
    expect(await getOutbox()).toEqual([]);
  });
});

describe('snapshotItems (account-link upload)', () => {
  const settings = {
    heightUnit: 'cm' as const,
    weightUnit: 'kg' as const,
    bodyWeightUnit: 'kg' as const,
    workoutSoundsEnabled: true,
    themePreference: 'auto' as const,
    profile: {},
  };

  it('uploads every row; sessions keep their own clock, the rest are stamped now', () => {
    const items = snapshotItems(
      {
        sessions: [session('s1', T2)],
        templates: [template('t1', 'T')],
        folders: [{ id: 'f1', name: 'F' }],
        customExercises: [{ id: 'c1' } as never],
        exercisePrevious: { 'bench-press': { weightKg: 60 } },
        exerciseNotes: { squat: 'x' },
        appSettings: settings,
      },
      T3
    );
    expect(items.map((i) => `${i.entityType}:${i.entityId}:${i.updatedAt}`)).toEqual([
      `session:s1:${T2}`,
      `template:t1:${T3}`,
      `template_folder:f1:${T3}`,
      `custom_exercise:c1:${T3}`,
      `exercise_previous:default:${T3}`,
      `exercise_note:default:${T3}`,
      `app_settings:default:${T3}`,
    ]);
  });

  it('skips empty previous/notes maps but always sends settings', () => {
    const items = snapshotItems(
      {
        sessions: [],
        templates: [],
        folders: [],
        customExercises: [],
        exercisePrevious: {},
        exerciseNotes: {},
        appSettings: settings,
      },
      T3
    );
    expect(items.map((i) => i.entityType)).toEqual(['app_settings']);
  });
});

describe('applyRemoteRecords and a concurrent enqueue (H2)', () => {
  it('keeps an outbox entry queued while the merge was running', async () => {
    await setOutbox([
      { entityType: 'recovery', entityId: 'default', op: 'upsert', payload: [], updatedAt: T1 },
    ]);
    const { enqueueOutbox } = await import('./outbox');
    await Promise.all([
      applyRemoteRecords([remote('template', 't9', template('t9', 'Remote'), T2)]),
      enqueueOutbox({ entityType: 'session', entityId: 'new', op: 'upsert', payload: {}, updatedAt: T3 }),
    ]);
    expect((await getOutbox()).map((e) => `${e.entityType}:${e.entityId}`)).toEqual(['session:new']);
  });
});
