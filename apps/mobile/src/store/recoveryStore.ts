import { create } from 'zustand';
import type { MuscleRecovery } from '@muscleos/types';
import { getRecovery } from '@/storage/localStorage';
import { getRecoveryUntil } from '@/utils/recovery';

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
    const items = await getRecovery();
    set({ items, isLoading: false });
  },

  activeRecovery: () => {
    const now = new Date().toISOString();
    return get().items.filter((r) => getRecoveryUntil(r) > now);
  },
}));
