import type { WorkoutSession } from '@muscleos/types';
import type { RestAfter } from '@/store/activeWorkoutLogic';
import { formatClock } from '@/utils/formatClock';

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

/** Notification titles (both delivery paths). */
export const WORKOUT_NOTIFICATION_TITLES = {
  /** expo-notifications ongoing tray entry. */
  tray: 'MuscleOS — Workout',
  /** Native Android live notification while a countdown runs. */
  resting: 'Resting',
  /** Native Android live notification between rests. */
  idle: 'Workout in progress',
  /** The rest-over alert. */
  restOver: 'Rest over',
} as const;

/**
 * The expo-notifications tray entry (iOS, and Android builds without the native module).
 * While a rest runs the body leads with it: an absolute clock time (`Rest until 10:42 AM • …`)
 * when the entry can't tick — always on iOS, and on Android once backgrounded — or a live
 * `Rest m:ss • …` countdown on Android in the foreground. Otherwise the idle body.
 */
export function trayNotificationContent(
  copy: WorkoutNotificationCopy,
  restEndTime: number | null,
  preferAbsoluteRestTime: boolean,
  now: number,
  formatClockTime: (epochMs: number) => string
): { title: string; body: string } {
  const title = WORKOUT_NOTIFICATION_TITLES.tray;
  if (restEndTime != null && restEndTime > now) {
    const lead = preferAbsoluteRestTime
      ? `Rest until ${formatClockTime(restEndTime)}`
      : `Rest ${formatClock(Math.ceil((restEndTime - now) / 1000))}`;
    return { title, body: `${lead} • ${copy.restBody}` };
  }
  return { title, body: copy.idleBody };
}
