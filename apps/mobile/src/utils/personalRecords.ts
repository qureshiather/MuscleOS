import {
  compareToStrengthStandards,
  STRENGTH_LEVEL_LABELS,
  type StrengthLevel,
} from '@/data/strengthStandards';
import type { ExercisePR, SetWithDate } from '@/utils/oneRepMax';
import { textMatchesQuery } from '@/utils/exerciseSearch';

/** The biodata strength standards need (`UserAppProfile` fields). */
export type StrengthProfile = { weightKg?: number; sex?: 'male' | 'female' };

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
};

/** Profile has what strength standards need: a positive bodyweight and a sex. */
export function hasStrengthProfile(profile: StrengthProfile): boolean {
  return profile.weightKg != null && profile.weightKg > 0 && profile.sex != null;
}

/**
 * Strength level for an exercise's best e1RM, or null when the profile is missing bodyweight or
 * sex, or the exercise has no standards.
 */
export function strengthSummary(
  exerciseId: string,
  best1RMKg: number,
  profile: StrengthProfile
): StrengthSummary | null {
  if (!profile.sex || profile.weightKg == null || profile.weightKg <= 0) return null;
  const c = compareToStrengthStandards(exerciseId, best1RMKg, profile.weightKg, profile.sex);
  if (!c.hasStandards) return null;
  return {
    level: c.level,
    label: STRENGTH_LEVEL_LABELS[c.level],
    next:
      c.nextLevelName && c.nextLevel1RMKg != null
        ? { label: c.nextLevelName, oneRepMaxKg: c.nextLevel1RMKg }
        : null,
  };
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
