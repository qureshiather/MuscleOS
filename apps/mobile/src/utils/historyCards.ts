import type { WorkoutSession } from '@muscleos/types';
import { startOfWeek } from '@/utils/homeStats';
import { estimatedOneRepMax } from '@/utils/oneRepMax';
import { sessionVolumeKg } from '@/utils/sessionStats';

/** Ad-hoc sessions have no template to compare against. */
const EMPTY_TEMPLATE_ID = '_empty';

function oldestFirst(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.completedAt != null)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
}

/**
 * Per session, the exercises whose best e1RM beat every earlier session's best for that
 * exercise. Uses the same qualifying sets as Personal Records (completed, weight > 0, reps ≥ 1).
 * The first session to log an exercise sets a baseline, not a PR. Ties are not PRs.
 */
export function buildSessionPRs(sessions: readonly WorkoutSession[]): Map<string, Set<string>> {
  const bestSoFar = new Map<string, number>();
  const result = new Map<string, Set<string>>();
  for (const session of oldestFirst(sessions)) {
    const bestHere = new Map<string, number>();
    for (const se of session.exercises) {
      for (const set of se.sets) {
        if (!set.completed || set.weightKg == null || set.weightKg <= 0) continue;
        const reps = set.reps ?? 0;
        if (reps < 1) continue;
        const e1rm = estimatedOneRepMax(set.weightKg, reps);
        if (e1rm > (bestHere.get(se.exerciseId) ?? 0)) bestHere.set(se.exerciseId, e1rm);
      }
    }
    const prs = new Set<string>();
    for (const [exerciseId, e1rm] of bestHere) {
      const prior = bestSoFar.get(exerciseId);
      if (prior != null && e1rm > prior) prs.add(exerciseId);
      if (prior == null || e1rm > prior) bestSoFar.set(exerciseId, e1rm);
    }
    if (prs.size > 0) result.set(session.id, prs);
  }
  return result;
}

/**
 * Per session, the volume change in whole percent against the previous completed session of the
 * same template. Missing when there is no earlier session, either volume is zero, or the session
 * is an empty workout.
 */
export function buildVolumeDeltas(sessions: readonly WorkoutSession[]): Map<string, number> {
  const lastVolume = new Map<string, number>();
  const result = new Map<string, number>();
  for (const session of oldestFirst(sessions)) {
    if (session.templateId === EMPTY_TEMPLATE_ID) continue;
    const volume = sessionVolumeKg(session);
    const prev = lastVolume.get(session.templateId);
    if (prev != null && prev > 0 && volume > 0) {
      result.set(session.id, Math.round(((volume - prev) / prev) * 100));
    }
    lastVolume.set(session.templateId, volume);
  }
  return result;
}

export type HistoryWeek = {
  /** Monday 00:00 local time, epoch ms. */
  weekStart: number;
  label: string;
  sessions: WorkoutSession[];
  volumeKg: number;
};

function weekLabel(weekStart: Date, now: Date): string {
  const thisWeek = startOfWeek(now).getTime();
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  if (weekStart.getTime() === thisWeek) return 'This week';
  if (weekStart.getTime() === lastWeek.getTime()) return 'Last week';
  const day = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return weekStart.getFullYear() === now.getFullYear()
    ? `Week of ${day}`
    : `Week of ${day}, ${weekStart.getFullYear()}`;
}

/**
 * Buckets completed sessions into Monday-start local weeks, newest week first, keeping the
 * incoming order within each week. Weeks with no sessions are skipped.
 */
export function groupSessionsByWeek(
  sessions: readonly WorkoutSession[],
  now = new Date()
): HistoryWeek[] {
  const weeks = new Map<number, HistoryWeek>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    const start = startOfWeek(new Date(session.completedAt));
    const key = start.getTime();
    let week = weeks.get(key);
    if (!week) {
      week = { weekStart: key, label: weekLabel(start, now), sessions: [], volumeKg: 0 };
      weeks.set(key, week);
    }
    week.sessions.push(session);
    week.volumeKg += sessionVolumeKg(session);
  }
  return [...weeks.values()].sort((a, b) => b.weekStart - a.weekStart);
}
