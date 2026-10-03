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

describe('session rules', () => {
  it('allows only one workout at a time', async () => {
    const { useActiveWorkoutStore } = await load();
    const s = useActiveWorkoutStore.getState();
    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    const first = useActiveWorkoutStore.getState().session;

    s.startWorkout('ppl-pull', [{ exerciseId: 'barbell-row' }]);
    expect(useActiveWorkoutStore.getState().session).toBe(first);
  });

  it('never removes the last set of an exercise', async () => {
    const { useActiveWorkoutStore } = await load();
    const s = useActiveWorkoutStore.getState();
    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press', sets: 2 }]);

    s.removeSet(0, 0);
    s.removeSet(0, 0);
    expect(useActiveWorkoutStore.getState().session?.exercises[0]?.sets).toHaveLength(1);
  });

  it('saves the whole session on finish — incomplete sets kept, prefill flags stripped', async () => {
    const { useActiveWorkoutStore, storage, sync } = await load();
    const s = useActiveWorkoutStore.getState();
    s.startWorkout('ppl-push', [{ exerciseId: 'bench-press', sets: 2 }]);
    s.setSetRecord(0, 0, { weightKg: 60, reps: 5, weightPrefilled: true, repsPrefilled: true });
    s.completeSet(0, 0);

    await s.finishWorkout('2026-01-01T11:00:00.000Z');

    const [saved] = await storage.getSessions();
    expect(saved?.completedAt).toBe('2026-01-01T11:00:00.000Z');
    expect(saved?.exercises[0]?.sets).toHaveLength(2);
    expect(saved?.exercises[0]?.sets[1]?.completed).toBe(false);
    for (const set of saved?.exercises[0]?.sets ?? []) {
      expect(set).not.toHaveProperty('weightPrefilled');
      expect(set).not.toHaveProperty('repsPrefilled');
    }
    expect(await storage.getExercisePrevious()).toEqual({ 'bench-press': { weightKg: 60, reps: 5 } });
    expect((await storage.getRecovery()).map((r) => r.muscleId)).toContain('chest');
    expect(useActiveWorkoutStore.getState().session).toBeNull();
    expect(sync.notifySessionUpsert).toHaveBeenCalledTimes(1);
  });
});

const activeWrites = (AsyncStorage: { setItem: unknown }) =>
  (AsyncStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([key]) => key === 'muscleos_active_workout'
  ).length;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('persisting the active workout', () => {
  it('debounces writes by 400 ms and coalesces a burst of edits into one write', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage, AsyncStorage } = await load();
    await hydrateActiveWorkout();
    await useActiveWorkoutStore.getState().startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    // let the start write land, then count only what the burst produces
    await sleep(450);
    const spy = vi.spyOn(AsyncStorage, 'setItem');

    const s = useActiveWorkoutStore.getState();
    s.setSetRecord(0, 0, { reps: 1 });
    s.setSetRecord(0, 0, { reps: 12 });
    s.setSetRecord(0, 0, { weightKg: 60 });
    await sleep(200);
    expect(activeWrites(AsyncStorage)).toBe(0); // still inside the debounce

    await vi.waitFor(() => expect(activeWrites(AsyncStorage)).toBe(1), { timeout: 1000 });
    await sleep(450);
    expect(activeWrites(AsyncStorage)).toBe(1);
    const saved = await storage.getActiveWorkout();
    expect(saved?.session.exercises[0].sets[0]).toMatchObject({ reps: 12, weightKg: 60 });
    spy.mockRestore();
  });

  it('writes immediately when the app backgrounds', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage, emit } = await load();
    await hydrateActiveWorkout();
    await useActiveWorkoutStore.getState().startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    await sleep(450);

    useActiveWorkoutStore.getState().setSetRecord(0, 0, { reps: 9 });
    emit('background');
    await vi.waitFor(
      async () => {
        expect((await storage.getActiveWorkout())?.session.exercises[0].sets[0].reps).toBe(9);
      },
      { timeout: 100 }
    );
  });

  it('does not write before hydration has finished', async () => {
    const { useActiveWorkoutStore, AsyncStorage } = await load();
    const spy = vi.spyOn(AsyncStorage, 'setItem');
    await useActiveWorkoutStore.getState().startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    await sleep(450);
    expect(activeWrites(AsyncStorage)).toBe(0);
    spy.mockRestore();
  });

  it('records an expired rest for its set when hydrating', async () => {
    const { useActiveWorkoutStore, hydrateActiveWorkout, storage } = await load();
    await storage.setActiveWorkout({
      ...snapshot(true, T0),
      restEndTime: T0 + 30_000,
      restTotalSeconds: 90,
      restAfter: { exIdx: 0, setIdx: 0 },
    });
    vi.setSystemTime(T0 + 10 * MINUTE);
    await hydrateActiveWorkout();
    const st = useActiveWorkoutStore.getState();
    expect(st.restEndTime).toBeNull();
    expect(st.restAfter).toBeNull();
    expect(st.restDurationsBetweenSets).toEqual({ '0-0': 90 });
  });
});

describe('starting a workout', () => {
  it('prefills empty working sets from previous once, at start', async () => {
    const { useActiveWorkoutStore, storage } = await load();
    await storage.setExercisePrevious({ 'bench-press': { weightKg: 80, reps: 6 } });
    await useActiveWorkoutStore
      .getState()
      .startWorkout('ppl-push', [{ exerciseId: 'bench-press', sets: 2, warmUpSets: 1 }]);
    const sets = useActiveWorkoutStore.getState().session?.exercises[0].sets;
    expect(sets?.[0]).toEqual({ completed: false, isWarmUp: true });
    expect(sets?.[1]).toMatchObject({ weightKg: 80, reps: 6, weightPrefilled: true, repsPrefilled: true });
    expect(sets?.[2]).toMatchObject({ weightKg: 80, reps: 6 });
  });

  it('never re-prefills a set the user cleared', async () => {
    const { useActiveWorkoutStore, storage } = await load();
    await storage.setExercisePrevious({ 'bench-press': { weightKg: 80, reps: 6 } });
    const s = useActiveWorkoutStore.getState();
    await s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    s.setSetRecord(0, 0, { weightKg: undefined, reps: undefined, weightPrefilled: false, repsPrefilled: false });
    // A second start (e.g. the screen remounting with params) is a no-op while a session exists.
    await s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    const set0 = useActiveWorkoutStore.getState().session?.exercises[0].sets[0];
    expect(set0?.weightKg).toBeUndefined();
    expect(set0?.reps).toBeUndefined();
  });

  it('keeps an edit made before the previous snapshot finished loading', async () => {
    const { useActiveWorkoutStore, storage } = await load();
    await storage.setExercisePrevious({ 'bench-press': { weightKg: 80, reps: 6 } });
    const s = useActiveWorkoutStore.getState();
    const started = s.startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
    s.setSetRecord(0, 0, { reps: 3 });
    await started;
    const sets = useActiveWorkoutStore.getState().session?.exercises[0].sets;
    expect(sets?.[0]).toEqual({ completed: false, reps: 3 }); // partial → left alone
    expect(sets?.[1]).toMatchObject({ weightKg: 80, reps: 6 });
  });
});

describe('set actions', () => {
  async function started(plan = [{ exerciseId: 'bench-press', sets: 3 }]) {
    const loaded = await load();
    await loaded.useActiveWorkoutStore.getState().startWorkout('ppl-push', plan);
    return loaded;
  }

  it('toggleSetComplete needs reps > 0, completes, and starts the work-set rest (default 120 s)', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    expect(s.toggleSetComplete(0, 0)).toBeNull();
    expect(useActiveWorkoutStore.getState().session?.exercises[0].sets[0].completed).toBe(false);

    s.setSetRecord(0, 0, { reps: 5, weightKg: 60 });
    expect(s.toggleSetComplete(0, 0)).toBe('completed');
    const st = useActiveWorkoutStore.getState();
    expect(st.session?.exercises[0].sets[0].completed).toBe(true);
    expect(st.restAfter).toEqual({ exIdx: 0, setIdx: 0 });
    expect(st.restTotalSeconds).toBe(120);
    expect(st.restEndTime).toBe(T0 + 120_000);
    // weight (not reps) carried into the next set as a suggestion
    expect(st.session?.exercises[0].sets[1]).toMatchObject({ weightKg: 60, weightPrefilled: true });
    expect(st.session?.exercises[0].sets[1].reps).toBeUndefined();
  });

  it('toggleSetComplete starts no timer for a warm-up without a warm-up rest, or after an explicit 0:00', async () => {
    const { useActiveWorkoutStore } = await started([{ exerciseId: 'bench-press', sets: 1 }]);
    const s = useActiveWorkoutStore.getState();
    s.addWarmUpSet(0);
    s.setSetRecord(0, 0, { reps: 10 });
    s.toggleSetComplete(0, 0);
    expect(useActiveWorkoutStore.getState().restEndTime).toBeNull();

    s.setExerciseRestBetweenSets(0, 0);
    s.setSetRecord(0, 1, { reps: 5 });
    s.toggleSetComplete(0, 1);
    expect(useActiveWorkoutStore.getState().restEndTime).toBeNull();
  });

  it('toggleSetComplete uses the warm-up rest when one is set', async () => {
    const { useActiveWorkoutStore } = await started([{ exerciseId: 'bench-press', sets: 1 }]);
    const s = useActiveWorkoutStore.getState();
    s.addWarmUpSet(0);
    s.setExerciseWarmUpRest(0, 45);
    s.setSetRecord(0, 0, { reps: 10 });
    s.toggleSetComplete(0, 0);
    expect(useActiveWorkoutStore.getState().restTotalSeconds).toBe(45);
  });

  it('toggleSetComplete on a completed set un-completes it and cancels its countdown', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.setSetRecord(0, 0, { reps: 5, weightKg: 60 });
    s.toggleSetComplete(0, 0);
    expect(s.toggleSetComplete(0, 0)).toBe('uncompleted');
    const st = useActiveWorkoutStore.getState();
    expect(st.session?.exercises[0].sets[0]).toMatchObject({ completed: false, reps: 5, weightKg: 60 });
    expect(st.restEndTime).toBeNull();
    expect(st.restAfter).toBeNull();
    // the weight carried into the next set is not taken back
    expect(st.session?.exercises[0].sets[1].weightKg).toBe(60);
  });

  it('un-completing a different set leaves a running countdown alone', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.setSetRecord(0, 0, { reps: 5 });
    s.setSetRecord(0, 1, { reps: 5 });
    s.toggleSetComplete(0, 0);
    s.toggleSetComplete(0, 1); // rest now follows set 1
    s.toggleSetComplete(0, 0);
    expect(useActiveWorkoutStore.getState().restAfter).toEqual({ exIdx: 0, setIdx: 1 });
  });

  it('skipRest records the elapsed time against the set and clears the timer', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.startRest(0, 0, 120);
    vi.setSystemTime(T0 + 45_000);
    s.skipRest();
    const st = useActiveWorkoutStore.getState();
    expect(st.restDurationsBetweenSets).toEqual({ '0-0': 45 });
    expect(st.restEndTime).toBeNull();
    expect(st.restAfter).toBeNull();
  });

  it('skipping a manual rest records nothing', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.startManualRest(60);
    vi.setSystemTime(T0 + 10_000);
    s.skipRest();
    expect(useActiveWorkoutStore.getState().restDurationsBetweenSets).toEqual({});
  });

  it('endRestIfDue records the full duration once the countdown reaches zero, then clears', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.startRest(0, 1, 90);
    expect(s.endRestIfDue(T0 + 89_000)).toBeNull();
    expect(useActiveWorkoutStore.getState().restEndTime).not.toBeNull();

    expect(s.endRestIfDue(T0 + 90_200)).toEqual({
      record: { exIdx: 0, setIdx: 1, seconds: 90 },
      playEndSound: true,
    });
    const st = useActiveWorkoutStore.getState();
    expect(st.restDurationsBetweenSets).toEqual({ '0-1': 90 });
    expect(st.restEndTime).toBeNull();
    expect(st.restAfter).toBeNull();
  });

  it('±30 on the running timer moves the total and end time together', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.startRest(0, 0, 120);
    s.add30SecondsRest();
    expect(useActiveWorkoutStore.getState()).toMatchObject({
      restTotalSeconds: 150,
      restEndTime: T0 + 150_000,
    });
    s.subtract30SecondsRest();
    s.subtract30SecondsRest();
    expect(useActiveWorkoutStore.getState()).toMatchObject({
      restTotalSeconds: 90,
      restEndTime: T0 + 90_000,
    });
  });

  it('addWarmUpSet inserts a warm-up at position 0 and shifts recorded rest and the running rest', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.recordRestDuration(0, 0, 60);
    s.startRest(0, 1, 120);
    s.addWarmUpSet(0);
    const st = useActiveWorkoutStore.getState();
    expect(st.session?.exercises[0].sets[0]).toEqual({ completed: false, isWarmUp: true });
    expect(st.session?.exercises[0].sets).toHaveLength(4);
    expect(st.restDurationsBetweenSets).toEqual({ '0-1': 60 });
    expect(st.restAfter).toEqual({ exIdx: 0, setIdx: 2 });
  });

  it('addSet appends a set carrying the last set’s weight and reps', async () => {
    const { useActiveWorkoutStore } = await started([{ exerciseId: 'bench-press', sets: 1 }]);
    const s = useActiveWorkoutStore.getState();
    s.setSetRecord(0, 0, { reps: 8, weightKg: 70 });
    s.addSet(0);
    expect(useActiveWorkoutStore.getState().session?.exercises[0].sets[1]).toEqual({
      completed: false,
      weightKg: 70,
      weightPrefilled: true,
      reps: 8,
      repsPrefilled: true,
    });
  });

  it('removeSet clears a countdown running for that set and shifts a later one', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.startRest(0, 1, 120);
    s.removeSet(0, 1);
    expect(useActiveWorkoutStore.getState()).toMatchObject({ restEndTime: null, restAfter: null });

    s.startRest(0, 1, 120);
    s.removeSet(0, 0);
    expect(useActiveWorkoutStore.getState().restAfter).toEqual({ exIdx: 0, setIdx: 0 });
  });
});

describe('exercise actions', () => {
  async function started() {
    const loaded = await load();
    await loaded.useActiveWorkoutStore
      .getState()
      .startWorkout('ppl-push', [{ exerciseId: 'bench-press' }, { exerciseId: 'squat' }]);
    return loaded;
  }

  it('addExercise appends 3 sets prefilled from the snapshot, and never adds a duplicate', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.addExercise('barbell-row', { weightKg: 50, reps: 10 });
    const ex = useActiveWorkoutStore.getState().session?.exercises;
    expect(ex?.map((e) => e.exerciseId)).toEqual(['bench-press', 'squat', 'barbell-row']);
    expect(ex?.[2].sets).toHaveLength(3);
    expect(ex?.[2].sets[0]).toMatchObject({ weightKg: 50, reps: 10, weightPrefilled: true });

    const before = useActiveWorkoutStore.getState().session;
    s.addExercise('squat');
    expect(useActiveWorkoutStore.getState().session).toBe(before);
  });

  it('replaceExercise with the same id, or one already in the workout, is a no-op', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    const before = useActiveWorkoutStore.getState().session;
    s.replaceExercise(0, 'bench-press');
    s.replaceExercise(0, 'squat');
    expect(useActiveWorkoutStore.getState().session).toBe(before);
  });

  it('replaceExercise resets the slot, drops its recorded rest and clears its running rest', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.setSetRecord(0, 0, { reps: 5, weightKg: 100, completed: true });
    s.recordRestDuration(0, 0, 60);
    s.recordRestDuration(1, 0, 30);
    s.startRest(0, 0, 120);
    s.replaceExercise(0, 'incline-bench', { weightKg: 40, reps: 8 });
    const st = useActiveWorkoutStore.getState();
    expect(st.session?.exercises[0].exerciseId).toBe('incline-bench');
    expect(st.session?.exercises[0].sets.every((x) => !x.completed && x.weightKg === 40)).toBe(true);
    expect(st.restDurationsBetweenSets).toEqual({ '1-0': 30 });
    expect(st).toMatchObject({ restEndTime: null, restAfter: null });
  });

  it('removeExercise clears its running rest and remaps the recorded durations', async () => {
    const { useActiveWorkoutStore } = await started();
    const s = useActiveWorkoutStore.getState();
    s.recordRestDuration(1, 0, 30);
    s.startRest(0, 0, 120);
    s.removeExercise(0);
    const st = useActiveWorkoutStore.getState();
    expect(st.session?.exercises.map((e) => e.exerciseId)).toEqual(['squat']);
    expect(st.restDurationsBetweenSets).toEqual({ '0-0': 30 });
    expect(st).toMatchObject({ restEndTime: null, restAfter: null });
  });
});
