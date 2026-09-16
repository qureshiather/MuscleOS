import type { WorkoutSession } from '@muscleos/types';
import type { RestAfter } from '@/store/activeWorkoutLogic';

/**
 * Copy for the ongoing-workout notification (docs/features/workout-logging.md#notifications).
 *
 * Notification bodies name the *upcoming* work, not the set just finished. Rest always starts
 * after a working set — including the last one of an exercise — so when the resting exercise
 * still has sets left it stays "Next: <it>", otherwise the copy advances to the next exercise
 * with unlogged sets ("Continue to <next>"), and finally "Finish your workout".
 */
export interface WorkoutNotificationCopy {
  restBody: string;
  idleBody: string;
  alertBody: string;
}

function hasIncompleteSets(se: WorkoutSession['exercises'][number] | undefined): boolean {
  return !!se && se.sets.some((s) => !s.completed);
}

export function workoutNotificationCopy(
  session: WorkoutSession,
  restAfter: RestAfter | null,
  nameOf: (exerciseId: string) => string
): WorkoutNotificationCopy {
  const forExercise = (name: string, advancing: boolean): WorkoutNotificationCopy => ({
    restBody: advancing ? `Continue to ${name}` : `Next: ${name}`,
    idleBody: advancing ? `Continue to ${name}` : `Next: ${name}`,
    alertBody: `Time for ${name}`,
  });

  const done: WorkoutNotificationCopy = {
    restBody: 'Finish your workout',
    idleBody: 'Finish your workout',
    alertBody: 'Time to finish your workout',
  };

  const findIncompleteFrom = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      const se = session.exercises[i];
      if (hasIncompleteSets(se)) return se;
    }
    return undefined;
  };

  if (restAfter != null) {
    const current = session.exercises[restAfter.exIdx];
    if (hasIncompleteSets(current)) {
      return forExercise(nameOf(current.exerciseId), false);
    }
    const next =
      findIncompleteFrom(restAfter.exIdx + 1, session.exercises.length) ??
      findIncompleteFrom(0, restAfter.exIdx);
    if (next) return forExercise(nameOf(next.exerciseId), true);
    return done;
  }

  const next = findIncompleteFrom(0, session.exercises.length);
  if (next) return forExercise(nameOf(next.exerciseId), false);
  return done;
}
