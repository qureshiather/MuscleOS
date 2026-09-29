import { create } from 'zustand';
import type { MuscleRecovery } from '@muscleos/types';
import { getSessions, setRecovery } from '@/storage/localStorage';
import { activeRecoveryAt, recoveryFromSessions } from '@/utils/recovery';
import { useExercisesStore } from '@/store/exercisesStore';

export interface RecoveryState {
  items: MuscleRecovery[];
  isLoading: boolean;
  load: () => Promise<void>;
  /** Only items still in recovery (derived recoveryUntil > now) */
  activeRecovery: () => MuscleRecovery[];
}

export const useRecoveryStore = create<RecoveryState>((set, get) => ({
  items: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const sessions = await getSessions();
    const items = recoveryFromSessions(sessions, (id) => useExercisesStore.getState().getExercise(id));
    await setRecovery(items);
    set({ items, isLoading: false });
  },

  activeRecovery: () => activeRecoveryAt(get().items, new Date()),
}));
