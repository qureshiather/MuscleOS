import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, WorkoutSession } from '@muscleos/types';

/**
 * recoveryStore wiring on the AsyncStorage harness (docs/features/recovery.md#when-recovery-is-recomputed):
 * load() recomputes from stored sessions and persists only on change, ensureLoaded() computes once
 * per app run, overlapping loads resolve to the latest, and an exercises-store change recomputes.
 * Re-imported per test because the store keeps module-level state (load generation, in-flight).
 */

vi.mock('@/sync', () => ({
  notifyCustomExerciseUpsert: vi.fn(),
  notifyCustomExerciseDelete: vi.fn(),
}));
vi.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: vi.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));

const T0 = Date.parse('2026-01-01T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const finished = (id: string, completedAt: number, exerciseId: string): WorkoutSession => ({
  id,
  templateId: 't',
  startedAt: new Date(completedAt - HOUR).toISOString(),
  completedAt: new Date(completedAt).toISOString(),
  exercises: [{ exerciseId, sets: [{ completed: true, reps: 5, weightKg: 60 }] }],
});

async function load() {
  vi.resetModules();
  const storage = await import('@/storage/localStorage');
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  const { STORAGE_KEYS } = await import('@/storage/keys');
  const { useExercisesStore } = await import('@/store/exercisesStore');
  const { useRecoveryStore } = await import('./recoveryStore');
  return { storage, AsyncStorage, STORAGE_KEYS, useExercisesStore, useRecoveryStore };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  (await import('@/test/mocks/asyncStorage')).__resetAsyncStorage();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('recoveryStore', () => {
  it('starts loading with nothing computed', async () => {
    const { useRecoveryStore } = await load();
    expect(useRecoveryStore.getState()).toMatchObject({ items: [], isLoading: true, hasLoaded: false });
  });

  it('load() recomputes from stored sessions and persists the result', async () => {
    const { storage, useRecoveryStore } = await load();
    await storage.setSessions([finished('a', T0 - HOUR, 'barbell-row')]);
    await useRecoveryStore.getState().load();
    const { items, isLoading, hasLoaded } = useRecoveryStore.getState();
    expect(isLoading).toBe(false);
    expect(hasLoaded).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((r) => r.trainedAt === new Date(T0 - HOUR).toISOString())).toBe(true);
    expect(await storage.getRecovery()).toEqual(items);
  });

  it('does not rewrite storage or state when the recompute is unchanged', async () => {
    const { storage, AsyncStorage, STORAGE_KEYS, useRecoveryStore } = await load();
    await storage.setSessions([finished('a', T0 - HOUR, 'barbell-row')]);
    await useRecoveryStore.getState().load();
    const before = useRecoveryStore.getState().items;
    const setItem = vi.spyOn(AsyncStorage, 'setItem');
    await useRecoveryStore.getState().load();
    expect(useRecoveryStore.getState().items).toBe(before);
    expect(setItem.mock.calls.filter(([k]) => k === STORAGE_KEYS.recovery)).toHaveLength(0);
  });

  it('activeRecovery() drops muscles whose window has passed, without a recompute', async () => {
    const { storage, useRecoveryStore } = await load();
    // Bench press: triceps 36 h, front delts 48 h, chest 72 h.
    await storage.setSessions([finished('push', T0 - HOUR, 'bench-press')]);
    await useRecoveryStore.getState().load();
    const ids = () => useRecoveryStore.getState().activeRecovery().map((r) => r.muscleId).sort();
    expect(ids()).toEqual(['chest', 'front_delts', 'triceps']);
    vi.setSystemTime(T0 - HOUR + 36 * HOUR);
    expect(ids()).toEqual(['chest', 'front_delts']);
    vi.setSystemTime(T0 - HOUR + 48 * HOUR);
    expect(ids()).toEqual(['chest']);
    vi.setSystemTime(T0 - HOUR + 72 * HOUR);
    expect(ids()).toEqual([]);
  });

  it('ensureLoaded() computes once, then is a no-op until load() is called again', async () => {
    const { storage, useRecoveryStore } = await load();
    await useRecoveryStore.getState().ensureLoaded();
    expect(useRecoveryStore.getState().items).toEqual([]);
    expect(useRecoveryStore.getState().hasLoaded).toBe(true);

    await storage.setSessions([finished('a', T0 - HOUR, 'bench-press')]);
    await useRecoveryStore.getState().ensureLoaded();
    expect(useRecoveryStore.getState().items).toEqual([]);

    await useRecoveryStore.getState().load();
    expect(useRecoveryStore.getState().items.length).toBeGreaterThan(0);
  });

  it('ensureLoaded() during a first load shares it instead of starting another', async () => {
    const { storage, useRecoveryStore } = await load();
    const getSessions = vi.spyOn(storage, 'getSessions');
    const first = useRecoveryStore.getState().load();
    const second = useRecoveryStore.getState().ensureLoaded();
    await Promise.all([first, second]);
    expect(getSessions).toHaveBeenCalledTimes(1);
  });

  it('keeps showing previous items (no loading flag) during later reloads', async () => {
    const { storage, useRecoveryStore } = await load();
    await storage.setSessions([finished('a', T0 - HOUR, 'bench-press')]);
    await useRecoveryStore.getState().load();
    const pending = useRecoveryStore.getState().load();
    expect(useRecoveryStore.getState().isLoading).toBe(false);
    expect(useRecoveryStore.getState().items.length).toBeGreaterThan(0);
    await pending;
  });

  it('resolves overlapping loads to the latest one', async () => {
    const { storage, useRecoveryStore } = await load();
    await storage.setSessions([finished('a', T0 - HOUR, 'bench-press')]);
    const stale = useRecoveryStore.getState().load();
    await storage.setSessions([]);
    const latest = useRecoveryStore.getState().load();
    await Promise.all([stale, latest]);
    expect(useRecoveryStore.getState().items).toEqual([]);
  });

  it('recomputes when the exercise catalog or custom exercises change (once loaded)', async () => {
    const { storage, useExercisesStore, useRecoveryStore } = await load();
    await storage.setSessions([finished('a', T0 - HOUR, 'custom_1')]);
    await useRecoveryStore.getState().load();
    expect(useRecoveryStore.getState().items).toEqual([]);

    const custom: Exercise = { id: 'custom_1', name: 'Mine', muscles: ['calves'], equipment: [] } as unknown as Exercise;
    useExercisesStore.setState({ customExercises: [custom] });
    await vi.waitFor(() =>
      expect(useRecoveryStore.getState().items.map((r) => r.muscleId)).toEqual(['calves'])
    );
  });

  it('does not compute on an exercises change before anything has loaded', async () => {
    const { storage, useExercisesStore, useRecoveryStore } = await load();
    const getSessions = vi.spyOn(storage, 'getSessions');
    useExercisesStore.setState({ customExercises: [] });
    expect(getSessions).not.toHaveBeenCalled();
    expect(useRecoveryStore.getState().hasLoaded).toBe(false);
  });
});
