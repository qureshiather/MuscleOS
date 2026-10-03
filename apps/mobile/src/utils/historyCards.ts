import type { SetRecord, WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import { startOfWeek } from '@/utils/homeStats';
import { estimatedOneRepMax } from '@/utils/oneRepMax';
import { formatCompactVolume, formatSessionDuration, formatVolume, sessionVolumeKg } from '@/utils/sessionStats';
import type { WeightUnit } from '@/utils/weightUnits';

/** Ad-hoc sessions have no template to compare against. */
const EMPTY_TEMPLATE_ID = '_empty';

/** Maps a logged exercise id to its canonical id (alias → current catalog id). Identity by default. */
export type CanonicalExerciseId = (exerciseId: string) => string;
const identity: CanonicalExerciseId = (id) => id;

/**
 * Display name for a session's template everywhere a finished session is listed: the template's
 * name, `Empty workout` for ad-hoc sessions, and `Workout` when the template no longer resolves.
 */
export function templateDisplayName(
  templates: readonly Pick<WorkoutTemplate, 'id' | 'name'>[],
  templateId: string
): string {
  const template = templates.find((t) => t.id === templateId);
  if (template) return template.name;
  return templateId === EMPTY_TEMPLATE_ID ? 'Empty workout' : 'Workout';
}

/** The newest session starts expanded and every other card collapsed; `toggled` flips either. */
export function isCardExpanded(
  id: string,
  newestId: string | undefined,
  toggled: ReadonlySet<string>
): boolean {
  return toggled.has(id) !== (id === newestId);
}

export type SessionCardSummary = {
  /** Exercises with at least one completed set, with only their completed sets. */
  exercises: { exerciseId: string; sets: SetRecord[] }[];
  exerciseCount: number;
  setCount: number;
  prCount: number;
  /** `6 exercises · 18 sets` */
  countsLine: string;
  /** `2 PRs`, or null when there are none (always null on Basic, which passes no PR ids). */
  prLabel: string | null;
  /** `59m · 5,518 kg`; either part dropped when missing or zero. Empty when both are. */
  statsLine: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Everything the collapsed History card shows, from the session and its PR exercise ids. */
export function sessionCardSummary(
  session: WorkoutSession,
  prExerciseIds: ReadonlySet<string> | undefined,
  weightUnit: WeightUnit
): SessionCardSummary {
  const exercises = session.exercises
    .map((se) => ({ exerciseId: se.exerciseId, sets: se.sets.filter((set) => set.completed) }))
    .filter((se) => se.sets.length > 0);
  const setCount = exercises.reduce((n, se) => n + se.sets.length, 0);
  const prCount = exercises.filter((se) => prExerciseIds?.has(se.exerciseId)).length;
  const volume = sessionVolumeKg(session);
  const statsLine = [formatSessionDuration(session), volume > 0 ? formatVolume(volume, weightUnit) : null]
    .filter(Boolean)
    .join(' · ');
  return {
    exercises,
    exerciseCount: exercises.length,
    setCount,
    prCount,
    countsLine: `${plural(exercises.length, 'exercise', 'exercises')} · ${plural(setCount, 'set', 'sets')}`,
    prLabel: prCount > 0 ? plural(prCount, 'PR', 'PRs') : null,
    statsLine,
  };
}

/** `↑4%` / `↓3%`, or null when there is no change to show (missing or 0%). */
export function volumeDeltaLabel(delta: number | undefined): { text: string; up: boolean } | null {
  if (delta == null || delta === 0) return null;
  return { text: `${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}%`, up: delta > 0 };
}

/** Week header summary: `1 session · 8,240 kg`, volume omitted when zero. */
export function weekSummary(week: Pick<HistoryWeek, 'sessions' | 'volumeKg'>, weightUnit: WeightUnit): string {
  const count = plural(week.sessions.length, 'session', 'sessions');
  return week.volumeKg > 0 ? `${count} · ${formatCompactVolume(week.volumeKg, weightUnit)}` : count;
}

function oldestFirst(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.completedAt != null)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
}

/**
 * Per session, the exercises whose best e1RM beat every earlier session's best for that
 * exercise. Uses the same qualifying sets as Personal Records (completed, weight > 0, reps ≥ 1).
 * The first session to log an exercise sets a baseline, not a PR. Ties are not PRs.
 *
 * Lifts are compared by canonical id, so a session logged under a legacy alias competes with the
 * current catalog id. The returned sets hold the ids **as logged in that session**, so the card
 * can match them against its own exercises.
 */
export function buildSessionPRs(
  sessions: readonly WorkoutSession[],
  canonicalId: CanonicalExerciseId = identity
): Map<string, Set<string>> {
  const bestSoFar = new Map<string, number>();
  const result = new Map<string, Set<string>>();
  for (const session of oldestFirst(sessions)) {
    const bestHere = new Map<string, number>();
    const loggedIds = new Map<string, string[]>();
    for (const se of session.exercises) {
      const id = canonicalId(se.exerciseId);
      for (const set of se.sets) {
        if (!set.completed || set.weightKg == null || set.weightKg <= 0) continue;
        const reps = set.reps ?? 0;
        if (reps < 1) continue;
        const e1rm = estimatedOneRepMax(set.weightKg, reps);
        if (e1rm > (bestHere.get(id) ?? 0)) bestHere.set(id, e1rm);
        const logged = loggedIds.get(id) ?? [];
        if (!logged.includes(se.exerciseId)) loggedIds.set(id, [...logged, se.exerciseId]);
      }
    }
    const prs = new Set<string>();
    for (const [id, e1rm] of bestHere) {
      const prior = bestSoFar.get(id);
      if (prior != null && e1rm > prior) for (const logged of loggedIds.get(id) ?? []) prs.add(logged);
      if (prior == null || e1rm > prior) bestSoFar.set(id, e1rm);
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
