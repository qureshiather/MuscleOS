import type { WorkoutSession } from '@muscleos/types';

/**
 * History card volume: Σ weightKg × reps over **completed** sets. Warm-ups are not excluded;
 * sets missing weight or reps contribute zero. Always kg.
 */
export function sessionVolumeKg(session: WorkoutSession): number {
  let total = 0;
  for (const se of session.exercises) {
    for (const set of se.sets) {
      if (!set.completed) continue;
      total += (set.weightKg ?? 0) * (set.reps ?? 0);
    }
  }
  return total;
}

/** `completedAt − startedAt` to the nearest minute: `45m`, `1h 15m`, `2h`. Null while in progress. */
export function formatSessionDuration(session: WorkoutSession): string | null {
  if (!session.startedAt || !session.completedAt) return null;
  const ms = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
