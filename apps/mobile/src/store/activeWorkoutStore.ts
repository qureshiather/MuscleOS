import { create } from 'zustand';
import type { WorkoutSession, SessionExercise, SetRecord } from '@muscleos/types';
import {
  getSessions,
  setSessions,
  getExercisePrevious,
  setExercisePrevious,
  type ExercisePrevious,
} from '@/storage/localStorage';
import { getRecovery, setRecovery } from '@/storage/localStorage';
import { DEFAULT_RECOVERY_HOURS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { getExercise } from '@/data/exercises';

const DEFAULT_SETS_PER_EXERCISE = 3;

export interface ActiveWorkoutState {
  session: WorkoutSession | null;
  startWorkout: (templateId: string, dayId: string, dayName: string, exerciseIds: string[], defaultSets?: number) => void;
  setSetRecord: (exerciseIndex: number, setIndex: number, record: Partial<SetRecord>) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  addExercise: (exerciseId: string) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
}

function createEmptySession(
  templateId: string,
  dayId: string,
  dayName: string,
  exerciseIds: string[],
  defaultSets?: number
): WorkoutSession {
  const numSets = defaultSets ?? DEFAULT_SETS_PER_EXERCISE;
  const sets = Array.from({ length: numSets }, () => ({ completed: false }));
  return {
    id: 'session_' + Date.now(),
    templateId,
    dayId,
    dayName,
    startedAt: new Date().toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({
      exerciseId,
      sets: [...sets],
    })),
  };
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  session: null,

  startWorkout: (templateId, dayId, dayName, exerciseIds, defaultSets) => {
    set({
      session: createEmptySession(templateId, dayId, dayName, exerciseIds, defaultSets),
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

  uncompleteSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const sets = [...ex.sets];
    if (!sets[setIndex]) return;
    sets[setIndex] = { ...sets[setIndex], completed: false };
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  addSet: (exerciseIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    exercises[exerciseIndex] = {
      ...ex,
      sets: [...ex.sets, { completed: false }],
    };
    set({ session: { ...session, exercises } });
  },

  addExercise: (exerciseId) => {
    const { session } = get();
    if (!session) return;
    const newEx: SessionExercise = {
      exerciseId,
      sets: [{ completed: false }, { completed: false }, { completed: false }],
    };
    set({
      session: {
        ...session,
        exercises: [...session.exercises, newEx],
      },
    });
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

    // Update previous weight/reps per exercise (best set by weight, then reps)
    const prev = await getExercisePrevious();
    for (const se of completed.exercises) {
      const best = se.sets
        .filter((s) => s.weightKg != null && s.weightKg > 0)
        .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
      if (best) {
        prev[se.exerciseId] = {
          weightKg: best.weightKg!,
          reps: best.reps,
        };
      }
    }
    await setExercisePrevious(prev);

    // Update recovery: only muscles from exercises that had at least one completed set
    const muscleIds = new Set<MuscleId>();
    for (const se of completed.exercises) {
      const hasCompletedSet = se.sets.some((s) => s.completed);
      if (!hasCompletedSet) continue;
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
