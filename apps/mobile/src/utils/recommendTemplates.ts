import type { MuscleId, WorkoutTemplate } from '@muscleos/types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Prefer templates that are at least half recovered. */
const MIN_READY_FRACTION = 0.5;
/** Soft preference for templates used in the last N days. */
const RECENT_WINDOW_DAYS = 30;
/** Penalize templates done within this window so we don't re-suggest today's work. */
const JUST_DONE_DAYS = 2;
/** How strongly to prefer templates whose muscles differ from recent work. */
const VARIETY_WEIGHT = 28;
/** Penalty per overlapping muscle when diversifying the suggestion list. */
const OVERLAP_PENALTY = 8;

export type RecommendedTemplate = {
  template: WorkoutTemplate;
  score: number;
  readyFraction: number;
  /** Fraction of template muscles not in recentlyWorkedMuscleIds. */
  varietyFraction: number;
};

export type RecommendTemplatesInput = {
  templates: WorkoutTemplate[];
  /** Muscles currently still recovering. */
  recoveringMuscleIds: ReadonlySet<MuscleId>;
  /** Muscles trained in recent completed sessions — favors different groups next. */
  recentlyWorkedMuscleIds?: ReadonlySet<MuscleId>;
  /** Resolve muscle targets for a template's exercises. */
  getTemplateMuscles: (template: WorkoutTemplate) => MuscleId[];
  lastDoneByTemplate: Record<string, string>;
  limit?: number;
  nowMs?: number;
};

function overlapCount(muscles: MuscleId[], covered: ReadonlySet<MuscleId>): number {
  let n = 0;
  for (const m of muscles) {
    if (covered.has(m)) n += 1;
  }
  return n;
}

/**
 * Rank visible templates by recovered-muscle coverage, variety vs recent work,
 * and a light recency bias. Skips templates with no known muscles or mostly still recovering.
 * Final picks are diversified so suggestions tend to hit different muscle groups.
 */
export function recommendTemplates({
  templates,
  recoveringMuscleIds,
  recentlyWorkedMuscleIds = new Set(),
  getTemplateMuscles,
  lastDoneByTemplate,
  limit = 4,
  nowMs = Date.now(),
}: RecommendTemplatesInput): RecommendedTemplate[] {
  const scored: Array<RecommendedTemplate & { muscles: MuscleId[] }> = [];

  for (const template of templates) {
    const muscles = [...new Set(getTemplateMuscles(template))];
    if (muscles.length === 0) continue;

    const readyCount = muscles.filter((m) => !recoveringMuscleIds.has(m)).length;
    const readyFraction = readyCount / muscles.length;
    if (readyFraction < MIN_READY_FRACTION) continue;

    const freshCount =
      recentlyWorkedMuscleIds.size === 0
        ? muscles.length
        : muscles.filter((m) => !recentlyWorkedMuscleIds.has(m)).length;
    const varietyFraction = freshCount / muscles.length;

    const lastDone = lastDoneByTemplate[template.id];
    const daysSinceLast = lastDone
      ? (nowMs - new Date(lastDone).getTime()) / DAY_MS
      : null;

    let score = readyFraction * 100;
    score += varietyFraction * VARIETY_WEIGHT;

    if (daysSinceLast != null && daysSinceLast <= RECENT_WINDOW_DAYS) {
      score += 5;
    }
    if (daysSinceLast != null && daysSinceLast < JUST_DONE_DAYS) {
      score -= 20;
    }
    // Never-done templates get a small novelty bump once recovery looks good
    if (daysSinceLast == null && readyFraction >= 0.75) {
      score += 3;
    }

    scored.push({
      template,
      score,
      readyFraction,
      varietyFraction,
      muscles,
    });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name)
  );

  // Greedy diversify: after the top pick, prefer candidates that overlap less
  // with muscles already covered by earlier suggestions.
  const selected: RecommendedTemplate[] = [];
  const remaining = [...scored];
  const covered = new Set<MuscleId>();

  while (selected.length < limit && remaining.length > 0) {
    remaining.sort((a, b) => {
      const adjA = a.score - overlapCount(a.muscles, covered) * OVERLAP_PENALTY;
      const adjB = b.score - overlapCount(b.muscles, covered) * OVERLAP_PENALTY;
      return adjB - adjA || a.template.name.localeCompare(b.template.name);
    });
    const next = remaining.shift()!;
    for (const m of next.muscles) covered.add(m);
    const { muscles: _muscles, ...rec } = next;
    selected.push(rec);
  }

  return selected;
}
