import { create } from 'zustand';
import type { MuscleRecovery } from '@muscleos/types';
import { getSessions, setRecovery } from '@/storage/localStorage';
import { recoveryFromSessions } from '@/utils/recovery';
import { getRecoveryUntil } from '@/utils/recoveryUntil';
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

  activeRecovery: () => {
    const now = new Date().toISOString();
    return get().items.filter((r) => getRecoveryUntil(r) > now);
  },
}));
