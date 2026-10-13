import {
  compareToStrengthStandards,
  STRENGTH_LEVEL_LABELS,
  type StrengthLevel,
} from '@/data/strengthStandards';
import type { WorkoutSession } from '@muscleos/types';
import { buildExercisePRs, type ExercisePR, type SetWithDate } from '@/utils/oneRepMax';
import { textMatchesQuery } from '@/utils/exerciseSearch';
import { KG_TO_LB, type WeightUnit } from '@/utils/weightUnits';

/** The biodata strength standards use (`UserAppProfile` fields); age is optional. */
export type StrengthProfile = { weightKg?: number; age?: number; sex?: 'male' | 'female' };

/** Bars on a Personal Records card: the most recent qualifying sets. */
export const PR_CARD_MAX_BARS = 10;

export type ProgressPoint = SetWithDate & {
  /** Bar height as a fraction of the best e1RM, 0–1. */
  ratio: number;
};

/**
 * Chart points for an exercise, **oldest to newest**, one per qualifying set, each with its bar
 * ratio to the best e1RM. Used by the progression chart and (last 10) the PR card bars.
 */
export function progressionPoints(history: readonly SetWithDate[], best1RM: number): ProgressPoint[] {
  return [...history]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((p) => ({ ...p, ratio: best1RM > 0 ? Math.min(1, p.estimated1RM / best1RM) : 0 }));
}

export type StrengthSummary = {
  level: StrengthLevel;
  label: string;
  /** Next level and the 1RM (kg) it needs; null at elite. */
  next: { label: string; oneRepMaxKg: number } | null;
  /** The age the thresholds were adjusted for, or null when they weren't (no age, or 23–40). */
  adjustedForAge: number | null;
};

/** Profile has what strength standards need: a positive bodyweight and a sex. */
export function hasStrengthProfile(profile: StrengthProfile): boolean {
  return profile.weightKg != null && profile.weightKg > 0 && profile.sex != null;
}

/**
 * Strength level for an exercise's best e1RM, or null when the profile is missing bodyweight or
 * sex, the exercise has no standards, or the lifter is under 14. Thresholds are age-adjusted when
 * the profile has an age.
 */
export function strengthSummary(
  exerciseId: string,
  best1RMKg: number,
  profile: StrengthProfile
): StrengthSummary | null {
  if (!profile.sex || profile.weightKg == null || profile.weightKg <= 0) return null;
  const c = compareToStrengthStandards(exerciseId, best1RMKg, profile.weightKg, profile.sex, profile.age);
  if (!c.hasStandards) return null;
  return {
    level: c.level,
    label: STRENGTH_LEVEL_LABELS[c.level],
    next:
      c.nextLevelName && c.nextLevel1RMKg != null
        ? { label: c.nextLevelName, oneRepMaxKg: c.nextLevel1RMKg }
        : null,
    adjustedForAge: profile.age != null && c.ageCoefficient !== 1 ? Math.floor(profile.age) : null,
  };
}

/** Progression strength card note when the thresholds were age-adjusted: "Adjusted for age 52". */
export function strengthAgeNote(strength: StrengthSummary): string | null {
  return strength.adjustedForAge != null ? `Adjusted for age ${strength.adjustedForAge}` : null;
}

export type PRCardModel = {
  /** Last 10 qualifying sets, oldest → newest like the chart. Null with fewer than 2 sets. */
  bars: ProgressPoint[] | null;
  strength: StrengthSummary | null;
};

/** What a Personal Records card shows beyond the exercise name and its numbers. */
export function prCardModel(pr: ExercisePR, profile: StrengthProfile): PRCardModel {
  const points = progressionPoints(pr.history, pr.bestEstimated1RM);
  return {
    bars: points.length >= 2 ? points.slice(-PR_CARD_MAX_BARS) : null,
    strength: strengthSummary(pr.exerciseId, pr.bestEstimated1RM, profile),
  };
}

/** Personal Records search: exercise name match (same matcher as the library), blank = all. */
export function filterPRsByName(
  prs: readonly ExercisePR[],
  query: string,
  nameOf: (exerciseId: string) => string
): ExercisePR[] {
  const q = query.trim();
  if (!q) return [...prs];
  return prs.filter((pr) => textMatchesQuery(nameOf(pr.exerciseId), q));
}

/**
 * Whether an exercise has any history to show on its progression screen — at least one qualifying
 * set in a completed session, counting sets logged under an alias of it. The exercise detail sheet
 * only links to history when this holds, so the link never lands on the empty state.
 */
export function exerciseHasHistory(
  completedSessions: WorkoutSession[],
  exerciseId: string,
  canonicalId: (exerciseId: string) => string = (id) => id
): boolean {
  const target = canonicalId(exerciseId);
  return buildExercisePRs(completedSessions, canonicalId).some((pr) => pr.exerciseId === target);
}

/** Lifts on the History tab's Progress strip, and the per-lift window it summarises. */
export const PROGRESS_STRIP_MAX_LIFTS = 6;
export const PROGRESS_SPARK_SESSIONS = 8;
export const PROGRESS_DELTA_DAYS = 30;

export type ProgressHighlight = {
  exerciseId: string;
  bestEstimated1RM: number;
  /** Completed sessions with a qualifying set of this lift. */
  sessionCount: number;
  /** Each recent session's best e1RM as a ratio of the all-time best, oldest → newest. */
  spark: number[];
  /**
   * How much the best e1RM rose in the last 30 days (kg): today's best minus the best from sets
   * logged before the window. 0 when it didn't rise; null when every set is inside the window,
   * so there's nothing to compare with.
   */
  gainKg: number | null;
};

/**
 * The History tab's Progress strip: your most-trained lifts (most sessions, then most recent,
 * then highest e1RM), each needing at least two sessions so there's progress to show.
 */
export function progressHighlights(
  prs: readonly ExercisePR[],
  nowMs: number,
  max: number = PROGRESS_STRIP_MAX_LIFTS
): ProgressHighlight[] {
  const cutoff = new Date(nowMs - PROGRESS_DELTA_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = prs.map((pr) => {
    // Session-best e1RM, keyed by the session's completedAt.
    const bySession = new Map<string, number>();
    for (const set of pr.history) {
      bySession.set(set.completedAt, Math.max(bySession.get(set.completedAt) ?? 0, set.estimated1RM));
    }
    const sessions = [...bySession.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const before = sessions.filter(([at]) => at < cutoff);
    const bestBefore = before.reduce((m, [, e]) => Math.max(m, e), 0);
    const best = pr.bestEstimated1RM;
    return {
      exerciseId: pr.exerciseId,
      bestEstimated1RM: best,
      sessionCount: sessions.length,
      spark: sessions
        .slice(-PROGRESS_SPARK_SESSIONS)
        .map(([, e]) => (best > 0 ? Math.min(1, e / best) : 0)),
      gainKg: before.length === 0 ? null : Math.max(0, best - bestBefore),
      lastAt: sessions[sessions.length - 1]?.[0] ?? '',
    };
  });
  return rows
    .filter((r) => r.sessionCount >= 2)
    .sort(
      (a, b) =>
        b.sessionCount - a.sessionCount ||
        b.lastAt.localeCompare(a.lastAt) ||
        b.bestEstimated1RM - a.bestEstimated1RM
    )
    .slice(0, max)
    .map(({ lastAt: _lastAt, ...h }) => h);
}

/** A Progress-strip gain in the user's unit: "+5 kg" (one decimal, `.0` dropped); null for none. */
export function formatProgressGain(gainKg: number | null, unit: WeightUnit): string | null {
  if (gainKg == null || gainKg <= 0) return null;
  const value = unit === 'lb' ? gainKg * KG_TO_LB : gainKg;
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded} ${unit}` : null;
}
