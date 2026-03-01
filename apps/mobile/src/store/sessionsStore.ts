import { create } from 'zustand';
import type { WorkoutSession } from '@muscleos/types';
import {
  getSessions,
  setSessions,
  getRecovery,
  setRecovery,
  getExercisePrevious,
  setExercisePrevious,
  type ExercisePrevious,
} from '@/storage/localStorage';
export interface SessionsState {
  sessions: WorkoutSession[];
  isLoading: boolean;
  load: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
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

  deleteSession: async (sessionId) => {
    const sessions = await getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const remaining = sessions.filter((s) => s.id !== sessionId);
    await setSessions(remaining);

    // Remove recovery impact for this workout (recovery uses startedAt as trainedAt)
    const recovery = await getRecovery();
    const updatedRecovery = recovery.filter((r) => r.trainedAt !== session.startedAt);
    await setRecovery(updatedRecovery);

    // Rebuild exercise previous from remaining sessions (newest first)
    const completed = remaining
      .filter((s) => s.completedAt != null)
      .sort((a, b) => (b.completedAt!.localeCompare(a.completedAt!)));
    const prev: Record<string, ExercisePrevious> = {};
    for (const s of completed) {
      for (const se of s.exercises) {
        if (prev[se.exerciseId]) continue;
        const best = se.sets
          .filter((set) => set.weightKg != null && set.weightKg > 0 && set.completed)
          .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
        if (best) {
          prev[se.exerciseId] = {
            weightKg: best.weightKg!,
            reps: best.reps,
          };
        }
      }
    }
    await setExercisePrevious(prev);

    set({ sessions: remaining });
  },

  completedSessions: () => {
    const { sessions } = get();
    return sessions
      .filter((s) => s.completedAt != null)
      .sort((a, b) => (b.completedAt!.localeCompare(a.completedAt!)));
  },
}));
