import type { WorkoutSession } from '@muscleos/types';

export type HomeStats = {
  /** Completed sessions since Monday of the current local week. */
  sessionsThisWeek: number;
  /** Consecutive weeks with at least one completed session, counting back from now. */
  weekStreak: number;
  /** At least one session completed today, local time. */
  trainedToday: boolean;
  /** Most recent completed session, if any. */
  lastCompletedAt: string | null;
};

const INVITE = 'Pick a template or start from scratch';

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
  const todayStart = startOfDay(now).getTime();
  const trainedWeeks = new Set<number>();
  let sessionsThisWeek = 0;
  let trainedToday = false;
  let lastCompletedAt: string | null = null;
  let lastCompletedMs = 0;

  for (const session of sessions) {
    if (!session.completedAt) continue;
    const completedAt = new Date(session.completedAt);
    const completedMs = completedAt.getTime();
    if (Number.isNaN(completedMs)) continue;
    const week = startOfWeek(completedAt).getTime();
    trainedWeeks.add(week);
    if (week === currentWeek.getTime()) sessionsThisWeek += 1;
    if (startOfDay(completedAt).getTime() === todayStart) trainedToday = true;
    if (completedMs > lastCompletedMs) {
      lastCompletedMs = completedMs;
      lastCompletedAt = session.completedAt;
    }
  }

  let cursor = trainedWeeks.has(currentWeek.getTime())
    ? currentWeek
    : shiftWeeks(currentWeek, -1);

  let weekStreak = 0;
  while (trainedWeeks.has(cursor.getTime())) {
    weekStreak += 1;
    cursor = shiftWeeks(cursor, -1);
  }

  return { sessionsThisWeek, weekStreak, trainedToday, lastCompletedAt };
}

/** One status line for the Workouts header — spoken, not a stats ticker. */
export function homeHeadline(stats: HomeStats, now = new Date()): string {
  const { sessionsThisWeek, weekStreak, trainedToday, lastCompletedAt } = stats;

  if (weekStreak > 1) {
    if (sessionsThisWeek === 0) return "You're streaking. Week's still open.";
    return `You're streaking. ${weekStreak} weeks in.`;
  }

  if (trainedToday && sessionsThisWeek === 1) return 'Already in today.';

  if (sessionsThisWeek > 0) return `${countWord(sessionsThisWeek)} this week.`;

  if (lastCompletedAt) {
    const days = daysBetween(startOfDay(new Date(lastCompletedAt)), startOfDay(now));
    if (days === 1) return 'Last one was yesterday.';
    if (days > 1 && days < 7) return `Last one was ${days} days ago.`;
  }

  return INVITE;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function countWord(n: number): string {
  if (n === 1) return 'One';
  if (n === 2) return 'Two';
  return String(n);
}
