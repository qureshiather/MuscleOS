import { create } from 'zustand';
import type { Exercise } from '@muscleos/types';
import {
  getCatalogCache,
  getCustomExercises,
  getRetiredCustomExercises,
  setCatalogCache,
  setCustomExercises,
  setRetiredCustomExercises,
} from '@/storage/localStorage';
import { CATALOG_SEED, CATALOG_SEED_UPDATED_AT } from '@/data/catalogSeed';
import { notifyCustomExerciseUpsert, notifyCustomExerciseDelete } from '@/sync';
import { mergeCatalogById, reconcileCatalogCache } from '@/sync/catalogMerge';
import { fetchCatalogDelta } from '@/sync/catalogPull';
import { nextCustomExerciseId, resolveExerciseById, retireExercise } from '@/utils/exerciseIds';
import { normalizeExercise } from '@/utils/exerciseNormalize';
import { libraryExercises } from '@/utils/exerciseLibraryFilter';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';

export interface ExercisesStoreState {
  catalogExercises: Exercise[];
  customExercises: Exercise[];
  /** Deleted customs: resolvable by `getExercise` for history, never listed or offered. */
  retiredExercises: Exercise[];
  isLoading: boolean;
  load: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  getExercise: (id: string) => Exercise | undefined;
  /** Published catalog + custom (custom last) */
  getAllExercises: () => Exercise[];
  addExercise: (exercise: Omit<Exercise, 'id'>) => Promise<Exercise>;
  updateExercise: (id: string, patch: Partial<Omit<Exercise, 'id'>>) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
}

let catalogPullInFlight: Promise<void> | null = null;

export const useExercisesStore = create<ExercisesStoreState>((set, get) => ({
  catalogExercises: CATALOG_SEED,
  customExercises: [],
  retiredExercises: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const [customExercises, retiredExercises, cache] = await Promise.all([
      getCustomExercises(),
      getRetiredCustomExercises(),
      getCatalogCache(),
    ]);
    const { catalog, write } = reconcileCatalogCache(cache, CATALOG_SEED, CATALOG_SEED_UPDATED_AT);
    if (write) await setCatalogCache(write);

    set({ catalogExercises: catalog, customExercises, retiredExercises, isLoading: false });
    void get().refreshCatalog();
  },

  refreshCatalog: async () => {
    if (catalogPullInFlight) return catalogPullInFlight;
    catalogPullInFlight = (async () => {
      const cache = await getCatalogCache();
      const watermark = cache.watermark ?? CATALOG_SEED_UPDATED_AT;
      const { exercises: delta, watermark: nextWatermark } = await fetchCatalogDelta(watermark);
      if (delta.length === 0) return;
      const merged = mergeCatalogById(get().catalogExercises, delta);
      await setCatalogCache({
        exercises: merged,
        watermark: nextWatermark,
        seedAppliedAt: CATALOG_SEED_UPDATED_AT,
      });
      set({ catalogExercises: merged });
    })().finally(() => {
      catalogPullInFlight = null;
    });
    return catalogPullInFlight;
  },

  getExercise: (id) =>
    resolveExerciseById(id, get().catalogExercises, get().customExercises, get().retiredExercises),

  getAllExercises: () => libraryExercises(get().catalogExercises, get().customExercises),

  addExercise: async (exercise) => {
    const { customExercises, retiredExercises } = get();
    const id = nextCustomExerciseId([...customExercises, ...retiredExercises]);
    const newEx = normalizeExercise({ ...exercise, id, isPublished: true });
    const next = [...customExercises, newEx];
    await setCustomExercises(next);
    set({ customExercises: next });
    notifyCustomExerciseUpsert(newEx);
    return newEx;
  },

  updateExercise: async (id, patch) => {
    const { customExercises } = get();
    const current = customExercises.find((e) => e.id === id);
    if (!current) return;
    const updated = normalizeExercise({ ...current, ...patch, id });
    const next = customExercises.map((e) => (e.id === id ? updated : e));
    await setCustomExercises(next);
    set({ customExercises: next });
    notifyCustomExerciseUpsert(updated);
  },

  removeExercise: async (id) => {
    const { customExercises, retiredExercises } = get();
    const removed = customExercises.find((e) => e.id === id);
    const next = customExercises.filter((e) => e.id !== id);
    // Past sessions reference the id only, so keep the definition to resolve their name and muscles.
    const retired = removed ? retireExercise(retiredExercises, removed) : retiredExercises;
    await Promise.all([setCustomExercises(next), setRetiredCustomExercises(retired)]);
    set({ customExercises: next, retiredExercises: retired });
    notifyCustomExerciseDelete(id);
    await useExerciseNotesStore.getState().removeNote(id);
  },
}));
