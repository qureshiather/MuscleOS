import { create } from 'zustand';
import type { Exercise } from '@muscleos/types';
import {
  getCatalogCache,
  getCustomExercises,
  setCatalogCache,
  setCustomExercises,
} from '@/storage/localStorage';
import { CATALOG_SEED, CATALOG_SEED_UPDATED_AT } from '@/data/catalogSeed';
import { notifyCustomExerciseUpsert, notifyCustomExerciseDelete } from '@/sync';
import { fetchCatalogDelta, mergeCatalogById } from '@/sync/catalogPull';
import { buildExerciseAliasMap } from '@/utils/exerciseSearch';
import { normalizeExercise } from '@/utils/exerciseNormalize';

export interface ExercisesStoreState {
  catalogExercises: Exercise[];
  customExercises: Exercise[];
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

function nextCustomId(custom: Exercise[]): string {
  const max = custom.reduce((acc, e) => {
    const m = e.id.match(/^custom_(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `custom_${max + 1}`;
}

function resolveExercise(
  id: string,
  catalog: Exercise[],
  custom: Exercise[]
): Exercise | undefined {
  const aliasMap = buildExerciseAliasMap(catalog);
  const resolved = aliasMap.get(id) ?? id;
  return catalog.find((e) => e.id === resolved) ?? custom.find((e) => e.id === resolved || e.id === id);
}

let catalogPullInFlight: Promise<void> | null = null;

export const useExercisesStore = create<ExercisesStoreState>((set, get) => ({
  catalogExercises: CATALOG_SEED,
  customExercises: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const [customExercises, cache] = await Promise.all([getCustomExercises(), getCatalogCache()]);

    let catalog = cache.exercises;
    let watermark = cache.watermark ?? CATALOG_SEED_UPDATED_AT;
    const seedNeedsApply =
      !cache.seedAppliedAt || cache.seedAppliedAt < CATALOG_SEED_UPDATED_AT || catalog.length === 0;

    if (seedNeedsApply) {
      catalog = mergeCatalogById(CATALOG_SEED, catalog);
      if (CATALOG_SEED_UPDATED_AT > watermark) watermark = CATALOG_SEED_UPDATED_AT;
      await setCatalogCache({
        exercises: catalog,
        watermark,
        seedAppliedAt: CATALOG_SEED_UPDATED_AT,
      });
    }

    set({ catalogExercises: catalog, customExercises, isLoading: false });
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

  getExercise: (id) => resolveExercise(id, get().catalogExercises, get().customExercises),

  getAllExercises: () => {
    const published = get().catalogExercises.filter((e) => e.isPublished !== false);
    return [...published, ...get().customExercises];
  },

  addExercise: async (exercise) => {
    const { customExercises } = get();
    const id = nextCustomId(customExercises);
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
    const { customExercises } = get();
    const next = customExercises.filter((e) => e.id !== id);
    await setCustomExercises(next);
    set({ customExercises: next });
    notifyCustomExerciseDelete(id);
  },
}));
