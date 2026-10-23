import { create } from 'zustand';
import type { WorkoutSession } from '@muscleos/types';
import {
  getSessions,
  setSessions,
  setExercisePrevious,
} from '@/storage/localStorage';
import { notifySessionDelete, notifySessionUpsert, notifyExercisePreviousSnapshot } from '@/sync';
import { applySessionEdit } from '@/utils/sessionEdit';
import { rebuildPreviousSnapshot } from '@/store/activeWorkoutLogic';
import { useRecoveryStore } from '@/store/recoveryStore';
/** Completed sessions, newest first (by `completedAt`). */
export function completedNewestFirst(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.completedAt != null)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
}

export interface SessionsState {
  sessions: WorkoutSession[];
  isLoading: boolean;
  load: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  /**
   * Saves an edit draft over its session (see `applySessionEdit`), then recomputes recovery and
   * rebuilds "previous" like a delete. False when the original is gone or the draft can't be saved.
   */
  saveSessionEdit: (draft: WorkoutSession) => Promise<boolean>;
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

    await useRecoveryStore.getState().load();

    const prev = rebuildPreviousSnapshot(remaining);
    await setExercisePrevious(prev);

    set({ sessions: remaining });
    notifySessionDelete(sessionId);
    notifyExercisePreviousSnapshot(prev);
  },

  saveSessionEdit: async (draft) => {
    const result = applySessionEdit(await getSessions(), draft, new Date().toISOString());
    if (!result) return false;
    await setSessions(result.sessions);

    await useRecoveryStore.getState().load();

    const prev = rebuildPreviousSnapshot(result.sessions);
    await setExercisePrevious(prev);

    set({ sessions: result.sessions });
    notifySessionUpsert(result.saved);
    notifyExercisePreviousSnapshot(prev);
    return true;
  },

  completedSessions: () => completedNewestFirst(get().sessions),
}));
