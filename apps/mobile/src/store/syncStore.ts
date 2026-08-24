import { create } from 'zustand';
import { getSyncMeta, latestSyncTime } from '@/sync/meta';

export interface SyncStoreState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  loadStatus: () => Promise<void>;
  setSyncing: (isSyncing: boolean) => void;
  setSynced: (isoDate: string) => void;
  setError: (message: string) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,

  loadStatus: async () => {
    const meta = await getSyncMeta();
    set({ lastSyncedAt: latestSyncTime(meta) });
  },

  setSyncing: (isSyncing) => set({ isSyncing, ...(isSyncing ? { lastError: null } : {}) }),

  setSynced: (isoDate) => set({ lastSyncedAt: isoDate, lastError: null, isSyncing: false }),

  setError: (message) => set({ lastError: message, isSyncing: false }),
}));
