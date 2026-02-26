import { create } from 'zustand';
import type { WorkoutSession, SessionExercise, SetRecord } from '@muscleos/types';
import { getSessions, setSessions } from '@/storage/localStorage';
import { getRecovery, setRecovery } from '@/storage/localStorage';
import { DEFAULT_RECOVERY_HOURS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { getExercise } from '@/data/exercises';

export interface ActiveWorkoutState {
  session: WorkoutSession | null;
  startWorkout: (templateId: string, dayId: string, dayName: string, exerciseIds: string[]) => void;
  setSetRecord: (exerciseIndex: number, setIndex: number, record: Partial<SetRecord>) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
}

function createEmptySession(
  templateId: string,
  dayId: string,
  dayName: string,
  exerciseIds: string[]
): WorkoutSession {
  return {
    id: 'session_' + Date.now(),
    templateId,
    dayId,
    dayName,
    startedAt: new Date().toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({
      exerciseId,
      sets: [{ completed: false }, { completed: false }, { completed: false }],
    })),
  };
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  session: null,

  startWorkout: (templateId, dayId, dayName, exerciseIds) => {
    set({
      session: createEmptySession(templateId, dayId, dayName, exerciseIds),
    });
  },

  setSetRecord: (exerciseIndex, setIndex, record) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const sets = [...ex.sets];
    if (!sets[setIndex]) return;
    sets[setIndex] = { ...sets[setIndex], ...record };
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  completeSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const sets = [...ex.sets];
    if (!sets[setIndex]) return;
    sets[setIndex] = { ...sets[setIndex], completed: true };
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  finishWorkout: async () => {
    const { session } = get();
    if (!session) return;
    const completed: WorkoutSession = {
      ...session,
      completedAt: new Date().toISOString(),
    };
    const sessions = await getSessions();
    await setSessions([...sessions, completed]);

    // Update recovery: collect all muscles from exercises and add recovery window
    const muscleIds = new Set<MuscleId>();
    for (const se of session.exercises) {
      const ex = getExercise(se.exerciseId);
      if (ex) ex.muscles.forEach((m) => muscleIds.add(m));
    }
    const now = new Date();
    const recoveryUntil = new Date(now.getTime() + DEFAULT_RECOVERY_HOURS * 60 * 60 * 1000);
    const recoveryList = await getRecovery();
    const newRecovery = Array.from(muscleIds).map((muscleId) => ({
      muscleId,
      trainedAt: session.startedAt,
      recoveryUntil: recoveryUntil.toISOString(),
    }));
    const merged = [...recoveryList.filter((r) => r.recoveryUntil > now.toISOString()), ...newRecovery];
    await setRecovery(merged);

    set({ session: null });
  },

  discardWorkout: () => set({ session: null }),
}));
