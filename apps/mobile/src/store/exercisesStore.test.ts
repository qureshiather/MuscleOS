import type { Exercise } from '@muscleos/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * exercisesStore wiring (docs/features/exercise-library.md): launch reconciliation against the
 * bundled seed, the non-blocking background refresh, delta merge + watermark, and custom CRUD.
 * The reconcile rules themselves are covered in sync/catalogMerge.test.ts.
 */

const pull = vi.hoisted(() => ({
  fetchCatalogDelta: vi.fn(async (watermark: string) => ({ exercises: [] as Exercise[], watermark })),
}));

vi.mock('@/sync', () => ({
  notifyCustomExerciseUpsert: vi.fn(),
  notifyCustomExerciseDelete: vi.fn(),
  notifyExerciseNotesSnapshot: vi.fn(),
}));
vi.mock('@/sync/catalogPull', () => pull);

async function load() {
  vi.resetModules();
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  const { STORAGE_KEYS } = await import('@/storage/keys');
  const sync = await import('@/sync');
  const seed = await import('@/data/catalogSeed');
  const { useExercisesStore } = await import('./exercisesStore');
  const { useExerciseNotesStore } = await import('./exerciseNotesStore');
  return { AsyncStorage, STORAGE_KEYS, sync, seed, useExercisesStore, useExerciseNotesStore };
}

const SEED_AT = '2026-10-08T00:00:00.000Z';

function exercise(id: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id,
    muscles: ['chest'],
    equipment: ['barbell'],
    category: 'free_weight',
    trackingType: 'weight_reps',
    isPublished: true,
    ...extra,
  };
}

beforeEach(async () => {
  const { __resetAsyncStorage } = await import('@/test/mocks/asyncStorage');
  __resetAsyncStorage();
  vi.clearAllMocks();
  pull.fetchCatalogDelta.mockReset();
  pull.fetchCatalogDelta.mockImplementation(async (watermark: string) => ({ exercises: [], watermark }));
});

describe('load', () => {
  it('applies the bundled seed (with instructions) to an empty cache and persists it', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS, seed } = await load();
    await useExercisesStore.getState().load();

    const state = useExercisesStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.catalogExercises).toHaveLength(seed.CATALOG_SEED.length);
    expect(state.getExercise('bench-press')?.instructions).toBeTruthy();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.catalogSeedAppliedAt)).toBe(SEED_AT);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.catalogWatermark)).toBe(SEED_AT);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.catalogExercises)) ?? '[]')).toHaveLength(
      seed.CATALOG_SEED.length
    );
  });

  it('applies the seed when the cache lacks seedAppliedAt', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.catalogExercises,
      JSON.stringify([exercise('bench-press', { name: 'Stale Name' })])
    );
    await useExercisesStore.getState().load();
    expect(useExercisesStore.getState().getExercise('bench-press')?.name).toBe('Bench Press');
  });

  it('applies a newer seed, keeping cache-only rows and a later watermark', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.catalogExercises,
      JSON.stringify([exercise('bench-press', { name: 'Stale' }), exercise('server-only-lift')])
    );
    await AsyncStorage.setItem(STORAGE_KEYS.catalogSeedAppliedAt, '2026-09-01T00:00:00.000Z');
    await AsyncStorage.setItem(STORAGE_KEYS.catalogWatermark, '2026-10-11T00:00:00.000Z');

    await useExercisesStore.getState().load();
    const state = useExercisesStore.getState();
    expect(state.getExercise('bench-press')?.name).toBe('Bench Press');
    expect(state.getExercise('server-only-lift')).toBeDefined();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.catalogWatermark)).toBe('2026-10-11T00:00:00.000Z');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.catalogSeedAppliedAt)).toBe(SEED_AT);
  });

  it('uses a current cache as-is', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.catalogExercises,
      JSON.stringify([exercise('bench-press', { name: 'Server Name', instructions: 'Server copy' })])
    );
    await AsyncStorage.setItem(STORAGE_KEYS.catalogSeedAppliedAt, SEED_AT);
    await AsyncStorage.setItem(STORAGE_KEYS.catalogWatermark, '2026-10-09T00:00:00.000Z');

    await useExercisesStore.getState().load();
    expect(useExercisesStore.getState().catalogExercises.map((e) => e.name)).toEqual(['Server Name']);
  });

  it('loads custom exercises and refreshes the catalog from the stored watermark', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.customExercises,
      JSON.stringify([exercise('custom_1', { name: 'Mine' })])
    );
    await useExercisesStore.getState().load();
    expect(useExercisesStore.getState().customExercises.map((e) => e.name)).toEqual(['Mine']);
    await vi.waitFor(() => expect(pull.fetchCatalogDelta).toHaveBeenCalledWith(SEED_AT));
  });

  it('sets state without waiting for the network refresh', async () => {
    const { useExercisesStore } = await load();
    pull.fetchCatalogDelta.mockImplementation(() => new Promise(() => {}));
    await useExercisesStore.getState().load();
    expect(useExercisesStore.getState().isLoading).toBe(false);
    expect(useExercisesStore.getState().catalogExercises.length).toBeGreaterThan(0);
  });
});

describe('refreshCatalog', () => {
  it('merges the delta, persists it and advances the watermark', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await useExercisesStore.getState().load();
    pull.fetchCatalogDelta.mockResolvedValueOnce({
      exercises: [exercise('bench-press', { name: 'Renamed' }), exercise('brand-new')],
      watermark: '2026-10-12T00:00:00.000Z',
    });

    await useExercisesStore.getState().refreshCatalog();
    const state = useExercisesStore.getState();
    expect(state.getExercise('bench-press')?.name).toBe('Renamed');
    expect(state.catalogExercises.at(-1)?.id).toBe('brand-new');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.catalogWatermark)).toBe('2026-10-12T00:00:00.000Z');
    const cached = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.catalogExercises)) ?? '[]');
    expect(cached.some((e: Exercise) => e.id === 'brand-new')).toBe(true);
  });

  it('writes nothing when the delta is empty (offline or failed pull)', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await useExercisesStore.getState().load();
    await useExercisesStore.getState().refreshCatalog();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.catalogWatermark)).toBe(SEED_AT);
  });

  it('shares one in-flight pull between concurrent callers', async () => {
    const { useExercisesStore } = await load();
    let release: () => void = () => {};
    pull.fetchCatalogDelta.mockImplementation(
      (watermark: string) =>
        new Promise((resolve) => {
          release = () => resolve({ exercises: [], watermark });
        })
    );
    const a = useExercisesStore.getState().refreshCatalog();
    const b = useExercisesStore.getState().refreshCatalog();
    await vi.waitFor(() => expect(pull.fetchCatalogDelta).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([a, b]);
    expect(pull.fetchCatalogDelta).toHaveBeenCalledTimes(1);
  });
});

describe('getAllExercises', () => {
  it('lists published catalog rows in catalog order, then customs', async () => {
    const { useExercisesStore } = await load();
    useExercisesStore.setState({
      catalogExercises: [exercise('b'), exercise('hidden', { isPublished: false }), exercise('a')],
      customExercises: [exercise('custom_1')],
    });
    expect(useExercisesStore.getState().getAllExercises().map((e) => e.id)).toEqual([
      'b',
      'a',
      'custom_1',
    ]);
    // Unpublished rows still resolve by id so old sessions render.
    expect(useExercisesStore.getState().getExercise('hidden')).toBeDefined();
  });

  it('hides the three unpublished seed rows from the 400-row bundled catalog', async () => {
    const { useExercisesStore } = await load();
    useExercisesStore.setState({ customExercises: [] });
    expect(useExercisesStore.getState().getAllExercises()).toHaveLength(397);
  });
});

describe('custom exercise CRUD', () => {
  it('adds with the next custom_<n> id, normalized, persisted and notified', async () => {
    const { useExercisesStore, AsyncStorage, STORAGE_KEYS, sync } = await load();
    useExercisesStore.setState({ customExercises: [exercise('custom_1'), exercise('custom_4')] });

    const created = await useExercisesStore.getState().addExercise({
      name: 'Band Pull-Apart',
      muscles: ['rear_delts'],
      equipment: ['band', 'bogus' as never],
      category: 'cable',
    });
    expect(created).toMatchObject({
      id: 'custom_5',
      equipment: ['band'],
      trackingType: 'weight_reps',
      isPublished: true,
    });
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.customExercises)) ?? '[]');
    expect(stored.map((e: Exercise) => e.id)).toEqual(['custom_1', 'custom_4', 'custom_5']);
    expect(sync.notifyCustomExerciseUpsert).toHaveBeenCalledWith(created);
  });

  it('updates a custom, letting undefined instructions clear them', async () => {
    const { useExercisesStore, sync } = await load();
    useExercisesStore.setState({
      customExercises: [exercise('custom_1', { name: 'Old', instructions: 'Old cue' })],
    });
    await useExercisesStore.getState().updateExercise('custom_1', {
      name: 'New',
      instructions: undefined,
    });
    const updated = useExercisesStore.getState().getExercise('custom_1');
    expect(updated?.name).toBe('New');
    expect(updated?.instructions).toBeUndefined();
    expect(sync.notifyCustomExerciseUpsert).toHaveBeenCalledWith(updated);
  });

  it('ignores updates to ids that are not customs', async () => {
    const { useExercisesStore, sync } = await load();
    useExercisesStore.setState({ customExercises: [] });
    await useExercisesStore.getState().updateExercise('bench-press', { name: 'Hacked' });
    expect(useExercisesStore.getState().getExercise('bench-press')?.name).toBe('Bench Press');
    expect(sync.notifyCustomExerciseUpsert).not.toHaveBeenCalled();
  });

  it('removes a custom, notifies the delete and drops its note', async () => {
    const { useExercisesStore, useExerciseNotesStore, AsyncStorage, STORAGE_KEYS, sync } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.exerciseNotes,
      JSON.stringify({ custom_1: 'seat 3', 'bench-press': 'arch' })
    );
    useExercisesStore.setState({ customExercises: [exercise('custom_1'), exercise('custom_2')] });

    // Notes not loaded yet: removal must load them first rather than overwrite storage.
    await useExercisesStore.getState().removeExercise('custom_1');

    expect(useExercisesStore.getState().customExercises.map((e) => e.id)).toEqual(['custom_2']);
    expect(sync.notifyCustomExerciseDelete).toHaveBeenCalledWith('custom_1');
    expect(useExerciseNotesStore.getState().notes).toEqual({ 'bench-press': 'arch' });
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.exerciseNotes)) ?? '{}')).toEqual({
      'bench-press': 'arch',
    });
  });

  it('retires a removed custom: still resolvable for history, never listed', async () => {
    const { AsyncStorage, STORAGE_KEYS, useExercisesStore } = await load();
    useExercisesStore.setState({ customExercises: [exercise('custom_1'), exercise('custom_2')] });
    await useExercisesStore.getState().removeExercise('custom_2');

    const state = useExercisesStore.getState();
    expect(state.getExercise('custom_2')?.id).toBe('custom_2');
    expect(state.getAllExercises().map((e) => e.id)).not.toContain('custom_2');
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.retiredCustomExercises)) ?? '[]')).toEqual([
      expect.objectContaining({ id: 'custom_2' }),
    ]);

    // A fresh load reads the retired list back.
    useExercisesStore.setState({ retiredExercises: [] });
    await useExercisesStore.getState().load();
    expect(useExercisesStore.getState().getExercise('custom_2')?.id).toBe('custom_2');
  });

  it('never reuses a deleted custom id, so a new exercise cannot inherit its history', async () => {
    const { useExercisesStore } = await load();
    useExercisesStore.setState({ customExercises: [exercise('custom_1'), exercise('custom_2')] });
    await useExercisesStore.getState().removeExercise('custom_2');
    const created = await useExercisesStore.getState().addExercise({
      name: 'X',
      muscles: ['chest'],
      equipment: [],
      category: 'machine',
    });
    expect(created.id).toBe('custom_3');
  });
});
