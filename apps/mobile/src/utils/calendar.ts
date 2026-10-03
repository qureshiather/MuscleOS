import type { WorkoutSession } from '@muscleos/types';

/** Monthly calendar column headers. Weeks start Monday, like the History week groups. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** `YYYY-MM-DD` for a date's **local** calendar day (not UTC). */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Weeks of a month as rows of 7 cells, Monday first. Days before the 1st and after the last day
 * are `null` blanks so every row is full. `month` is 0-based, as in `Date`.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): Sunday 0 … Saturday 6. Shift so Monday is column 0 and Sunday column 6.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;

  const flat: (number | null)[] = [];
  for (let i = 0; i < leading; i++) flat.push(null);
  for (let d = 1; d <= daysInMonth; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
  return rows;
}

/** Local day keys with at least one completed session. */
export function workoutDaysSet(sessions: readonly WorkoutSession[]): Set<string> {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.completedAt) days.add(localDayKey(new Date(s.completedAt)));
  }
  return days;
}

/** Completed sessions whose `completedAt` falls on the local day `dayKey`, in incoming order. */
export function sessionsOnDay(sessions: readonly WorkoutSession[], dayKey: string): WorkoutSession[] {
  return sessions.filter((s) => s.completedAt != null && localDayKey(new Date(s.completedAt)) === dayKey);
}
