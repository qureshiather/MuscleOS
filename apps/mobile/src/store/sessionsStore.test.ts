import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '@muscleos/types';

/**
 * sessionsStore wiring on the AsyncStorage harness (docs/features/history-analytics.md#deleting-a-session):
 * completedSessions() filter and order, and deleteSession() removing the session, recomputing
 * recovery, rebuilding the per-exercise previous map and queueing sync notifications.
 */

vi.mock('@/sync', () => ({
  notifySessionDelete: vi.fn(),
  notifyExercisePreviousSnapshot: vi.fn(),
  notifyCustomExerciseUpsert: vi.fn(),
  notifyCustomExerciseDelete: vi.fn(),
}));
vi.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: vi.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));

const T0 = Date.parse('2026-01-10T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const session = (
  id: string,
  completedAt: number | undefined,
  exerciseId = 'bench-press',
  weightKg = 60
): WorkoutSession => ({
  id,
  templateId: 'ppl-push',
  startedAt: new Date((completedAt ?? T0) - HOUR).toISOString(),
  completedAt: completedAt != null ? new Date(completedAt).toISOString() : undefined,
  exercises: [{ exerciseId, sets: [{ completed: true, reps: 5, weightKg }] }],
});

async function load() {
  vi.resetModules();
  const storage = await import('@/storage/localStorage');
  const sync = await import('@/sync');
  const { useRecoveryStore } = await import('@/store/recoveryStore');
  const { useSessionsStore } = await import('./sessionsStore');
  return { storage, sync, useRecoveryStore, useSessionsStore };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  (await import('@/test/mocks/asyncStorage')).__resetAsyncStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('completedSessions', () => {
  it('keeps only completed sessions, newest first', async () => {
    const { storage, useSessionsStore } = await load();
    await storage.setSessions([
      session('old', T0 - 48 * HOUR),
      session('open', undefined),
      session('new', T0 - HOUR),
      session('mid', T0 - 24 * HOUR),
    ]);
    await useSessionsStore.getState().load();
    expect(useSessionsStore.getState().isLoading).toBe(false);
    expect(useSessionsStore.getState().sessions).toHaveLength(4);
    expect(useSessionsStore.getState().completedSessions().map((s) => s.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('deleteSession', () => {
  it('removes the session from storage and state', async () => {
    const { storage, useSessionsStore } = await load();
    await storage.setSessions([session('a', T0 - 48 * HOUR), session('b', T0 - HOUR)]);
    await useSessionsStore.getState().load();
    await useSessionsStore.getState().deleteSession('b');
    expect((await storage.getSessions()).map((s) => s.id)).toEqual(['a']);
    expect(useSessionsStore.getState().sessions.map((s) => s.id)).toEqual(['a']);
  });

  it('recomputes recovery from the remaining sessions', async () => {
    const { storage, useRecoveryStore, useSessionsStore } = await load();
    await storage.setSessions([session('legs', T0 - HOUR, 'squat'), session('push', T0 - HOUR, 'bench-press')]);
    await useRecoveryStore.getState().load();
    expect(useRecoveryStore.getState().items.map((r) => r.muscleId)).toContain('chest');

    await useSessionsStore.getState().deleteSession('push');
    const muscles = useRecoveryStore.getState().items.map((r) => r.muscleId);
    expect(muscles).not.toContain('chest');
    expect(muscles).toContain('quads');
    expect((await storage.getRecovery()).map((r) => r.muscleId)).toEqual(muscles);
  });

  it('rebuilds the previous map from the most recent remaining session', async () => {
    const { storage, useSessionsStore } = await load();
    await storage.setSessions([
      session('older', T0 - 48 * HOUR, 'bench-press', 60),
      session('newest', T0 - HOUR, 'bench-press', 80),
    ]);
    await useSessionsStore.getState().deleteSession('newest');
    const prev = await storage.getExercisePrevious();
    expect(prev['bench-press']).toMatchObject({ weightKg: 60, reps: 5 });
  });

  it('queues sync notifications for the delete and the rebuilt previous map', async () => {
    const { storage, sync, useSessionsStore } = await load();
    await storage.setSessions([session('a', T0 - 48 * HOUR), session('b', T0 - HOUR)]);
    await useSessionsStore.getState().deleteSession('b');
    expect(sync.notifySessionDelete).toHaveBeenCalledWith('b');
    expect(sync.notifyExercisePreviousSnapshot).toHaveBeenCalledWith(await storage.getExercisePrevious());
  });

  it('does nothing for an unknown id', async () => {
    const { storage, sync, useSessionsStore } = await load();
    await storage.setSessions([session('a', T0 - HOUR)]);
    await useSessionsStore.getState().deleteSession('missing');
    expect(await storage.getSessions()).toHaveLength(1);
    expect(sync.notifySessionDelete).not.toHaveBeenCalled();
  });
});
