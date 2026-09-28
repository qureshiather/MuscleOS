import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedActiveWorkout } from '@/storage/localStorage';

/**
 * Store-level wiring for stale workouts (docs/features/workout-logging.md#stale-workouts): when
 * `lastActivityAt` is stamped, and that hydration and foregrounding close a forgotten workout.
 * The rule itself is covered in activeWorkoutLogic.test.ts.
 *
 * The store keeps module-level state (hydration promise, persist flags, AppState listeners), so
 * each test re-imports a fresh copy. Only `Date` is faked; the persist debounce uses real timers.
 */

vi.mock('@/sync', () => ({
  notifySessionUpsert: vi.fn(),
  notifySessionDelete: vi.fn(),
  notifyExercisePreviousSnapshot: vi.fn(),
  notifyCustomExerciseUpsert: vi.fn(),
  notifyCustomExerciseDelete: vi.fn(),
  syncAfterWorkout: vi.fn(),
}));
vi.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: vi.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));

const T0 = Date.parse('2026-01-01T10:00:00.000Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

async function load() {
  vi.resetModules();
  const storage = await import('@/storage/localStorage');
  const { STORAGE_KEYS } = await import('@/storage/keys');
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  const { __emitAppStateChange } = await import('@/test/mocks/reactNative');
  const sync = await import('@/sync');
  const store = await import('./activeWorkoutStore');
  return { ...store, storage, STORAGE_KEYS, AsyncStorage, sync, emit: __emitAppStateChange };
}

function snapshot(completed: boolean, lastActivityAt?: number): PersistedActiveWorkout {
  return {
    session: {
      id: 'session_1',
      templateId: 'ppl-push',
      startedAt: new Date(T0).toISOString(),
      exercises: [
        {
          exerciseId: 'bench-press',
          sets: [{ completed, reps: 5, weightKg: 60 }, { completed: false }],
        },
      ],
    },
    restEndTime: null,
    restTotalSeconds: 120,
    restAfter: null,
    restDurationsBetweenSets: {},
    ...(lastActivityAt != null && { lastActivityAt }),
  };
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

describe('lastActivityAt', () => {
  it('is stamped on start and on every session edit', async () => {
    const { useActiveWorkoutStore } = await load();
    const s = useActiveWorkoutStore.getState();

    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBe(T0);

    vi.setSystemTime(T0 + MINUTE);
    s.setSetRecord(0, 0, { reps: 5 });
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBe(T0 + MINUTE);

    vi.setSystemTime(T0 + 2 * MINUTE);
    s.addSet(0);
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBe(T0 + 2 * MINUTE);
  });

  it('is not bumped by rest-timer actions', async () => {
    const { useActiveWorkoutStore } = await load();
    const s = useActiveWorkoutStore.getState();
    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);

    vi.setSystemTime(T0 + MINUTE);
    s.startRest(0, 0, 90);
    s.add30SecondsRest();
    s.skipRest();
    s.recordRestDuration(0, 0, 60);
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBe(T0);
  });

  it('is cleared when the workout is discarded', async () => {
    const { useActiveWorkoutStore } = await load();
    const s = useActiveWorkoutStore.getState();
    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    s.discardWorkout();
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBeNull();
  });

  it('is persisted with the snapshot', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage, emit } = await load();
    await hydrateActiveWorkout();
    useActiveWorkoutStore.getState().startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    emit('background'); // immediate write, bypassing the debounce
    await vi.waitFor(async () => {
      expect((await storage.getActiveWorkout())?.lastActivityAt).toBe(T0);
    });
  });
});

describe('closing a stale workout on hydration', () => {
  it('finishes it as of the last activity when a set was completed', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage, sync } = await load();
    await storage.setActiveWorkout(snapshot(true, T0 + 30 * MINUTE));
    vi.setSystemTime(T0 + 2 * 24 * HOUR);

    await hydrateActiveWorkout();

    const sessions = await storage.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].completedAt).toBe(new Date(T0 + 30 * MINUTE).toISOString());
    expect(useActiveWorkoutStore.getState().session).toBeNull();
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBeNull();
    expect(sync.syncAfterWorkout).toHaveBeenCalledTimes(1);
  });

  it('discards it when nothing was completed', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage, sync } = await load();
    await storage.setActiveWorkout(snapshot(false, T0));
    vi.setSystemTime(T0 + 3 * HOUR);

    await hydrateActiveWorkout();

    expect(await storage.getSessions()).toEqual([]);
    expect(useActiveWorkoutStore.getState().session).toBeNull();
    expect(sync.syncAfterWorkout).not.toHaveBeenCalled();
  });

  it('resumes a workout idle for less than the threshold', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage } = await load();
    await storage.setActiveWorkout(snapshot(true, T0));
    vi.setSystemTime(T0 + 3 * HOUR - MINUTE);

    await hydrateActiveWorkout();

    expect(useActiveWorkoutStore.getState().session?.id).toBe('session_1');
    expect(useActiveWorkoutStore.getState().lastActivityAt).toBe(T0);
    expect(await storage.getSessions()).toEqual([]);
  });

  it('dates a legacy snapshot without lastActivityAt from its start', async () => {
    const { hydrateActiveWorkout, storage } = await load();
    await storage.setActiveWorkout(snapshot(true));
    vi.setSystemTime(T0 + 5 * HOUR);

    await hydrateActiveWorkout();

    const [finished] = await storage.getSessions();
    expect(finished.completedAt).toBe(new Date(T0).toISOString());
  });
});

describe('closing a stale workout on foreground', () => {
  async function startAndLogOneSet() {
    const loaded = await load();
    await loaded.hydrateActiveWorkout();
    const s = loaded.useActiveWorkoutStore.getState();
    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    vi.setSystemTime(T0 + 10 * MINUTE);
    s.setSetRecord(0, 0, { reps: 5, weightKg: 60, completed: true });
    return loaded;
  }

  it('finishes the workout when the app returns after the threshold', async () => {
    const { useActiveWorkoutStore, closeStaleWorkout, storage, emit } = await startAndLogOneSet();
    vi.setSystemTime(T0 + 10 * MINUTE + 3 * HOUR);

    emit('active');
    await closeStaleWorkout(); // joins the close the foreground event started

    const sessions = await storage.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].completedAt).toBe(new Date(T0 + 10 * MINUTE).toISOString());
    expect(useActiveWorkoutStore.getState().session).toBeNull();
  });

  it('leaves the workout running when the app returns before the threshold', async () => {
    const { useActiveWorkoutStore, closeStaleWorkout, storage, emit } = await startAndLogOneSet();
    vi.setSystemTime(T0 + 10 * MINUTE + 2 * HOUR);

    emit('active');
    await closeStaleWorkout();

    expect(useActiveWorkoutStore.getState().session).not.toBeNull();
    expect(await storage.getSessions()).toEqual([]);
  });

  it('saves the session once when closes overlap', async () => {
    const { closeStaleWorkout, storage, emit } = await startAndLogOneSet();
    vi.setSystemTime(T0 + 10 * MINUTE + 3 * HOUR);

    emit('active');
    emit('active');
    await Promise.all([closeStaleWorkout(), closeStaleWorkout()]);

    expect(await storage.getSessions()).toHaveLength(1);
  });
});
