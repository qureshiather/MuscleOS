import { create } from 'zustand';
import type { MuscleRecovery } from '@muscleos/types';
import { getSessions, setRecovery } from '@/storage/localStorage';
import { activeRecoveryAt, recoveryFromSessions, sameRecovery } from '@/utils/recovery';
import { useExercisesStore } from '@/store/exercisesStore';

export interface RecoveryState {
  items: MuscleRecovery[];
  /** True until the first load finishes. Later reloads keep showing the previous items. */
  isLoading: boolean;
  hasLoaded: boolean;
  /** Recompute from sessions. Call after anything that changes sessions. */
  load: () => Promise<void>;
  /** Load only if nothing has been computed yet (screen focus). */
  ensureLoaded: () => Promise<void>;
  /** Only items still in recovery (derived recoveryUntil > now) */
  activeRecovery: () => MuscleRecovery[];
}

/** Latest load() wins when calls overlap (finish workout, sync merge, focus). */
let loadGeneration = 0;
let inFlight: Promise<void> | null = null;

export const useRecoveryStore = create<RecoveryState>((set, get) => ({
  items: [],
  isLoading: true,
  hasLoaded: false,

  load: () => {
    const generation = ++loadGeneration;
    const run = (async () => {
      const sessions = await getSessions();
      if (generation !== loadGeneration) return;
      const items = recoveryFromSessions(sessions, (id) => useExercisesStore.getState().getExercise(id));
      if (get().hasLoaded && sameRecovery(get().items, items)) {
        set({ isLoading: false });
        return;
      }
      set({ items, isLoading: false, hasLoaded: true });
      await setRecovery(items);
    })();
    inFlight = run;
    const clear = () => {
      if (inFlight === run) inFlight = null;
    };
    run.then(clear, clear);
    return run;
  },

  ensureLoaded: () => {
    if (get().hasLoaded) return Promise.resolve();
    return inFlight ?? get().load();
  },

  activeRecovery: () => activeRecoveryAt(get().items, new Date()),
}));

// Muscle mappings come from the exercise catalog and customs, which load after app start and can
// change on catalog refresh. Recompute once they change so recovery never sticks to a partial map.
useExercisesStore.subscribe((state, prev) => {
  if (
    state.catalogExercises === prev.catalogExercises &&
    state.customExercises === prev.customExercises
  ) {
    return;
  }
  if (useRecoveryStore.getState().hasLoaded) void useRecoveryStore.getState().load();
});
