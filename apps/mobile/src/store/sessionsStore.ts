import { create } from 'zustand';
import type { WorkoutSession } from '@muscleos/types';
import { getSessions } from '@/storage/localStorage';

export interface SessionsState {
  sessions: WorkoutSession[];
  isLoading: boolean;
  load: () => Promise<void>;
  /** Completed sessions, newest first */
  completedSessions: () => WorkoutSession[];
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const sessions = await getSessions();
    set({ sessions, isLoading: false });
  },

  completedSessions: () => {
    const { sessions } = get();
    return sessions
      .filter((s) => s.completedAt != null)
      .sort((a, b) => (b.completedAt!.localeCompare(a.completedAt!)));
  },
}));
