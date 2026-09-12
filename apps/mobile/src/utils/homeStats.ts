import type { WorkoutSession } from '@muscleos/types';

export type HomeStats = {
  /** Completed sessions since Monday of the current local week. */
  sessionsThisWeek: number;
  /** Consecutive weeks with at least one completed session, counting back from now. */
  weekStreak: number;
};

/** Monday 00:00 local time for the week containing `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

function shiftWeeks(weekStart: Date, weeks: number): Date {
  const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/**
 * Header stats derived entirely from session history — nothing is persisted.
 *
 * The current week is treated as in progress: a streak survives until the week
 * itself ends, so training Sunday then opening the app Monday does not read as 0.
 */
export function computeHomeStats(sessions: readonly WorkoutSession[], now = new Date()): HomeStats {
  const currentWeek = startOfWeek(now);
  const trainedWeeks = new Set<number>();
  let sessionsThisWeek = 0;

  for (const session of sessions) {
    if (!session.completedAt) continue;
    const completedAt = new Date(session.completedAt);
    if (Number.isNaN(completedAt.getTime())) continue;
    const week = startOfWeek(completedAt).getTime();
    trainedWeeks.add(week);
    if (week === currentWeek.getTime()) sessionsThisWeek += 1;
  }

  let cursor = trainedWeeks.has(currentWeek.getTime())
    ? currentWeek
    : shiftWeeks(currentWeek, -1);

  let weekStreak = 0;
  while (trainedWeeks.has(cursor.getTime())) {
    weekStreak += 1;
    cursor = shiftWeeks(cursor, -1);
  }

  return { sessionsThisWeek, weekStreak };
}
