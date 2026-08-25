import type { MuscleId, WorkoutTemplate } from '@muscleos/types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Prefer templates that are at least half recovered. */
const MIN_READY_FRACTION = 0.5;
/** Soft preference for templates used in the last N days. */
const RECENT_WINDOW_DAYS = 30;
/** Penalize templates done within this window so we don't re-suggest today's work. */
const JUST_DONE_DAYS = 2;

export type RecommendedTemplate = {
  template: WorkoutTemplate;
  score: number;
  readyFraction: number;
  reason: string;
};

export type RecommendTemplatesInput = {
  templates: WorkoutTemplate[];
  /** Muscles currently still recovering. */
  recoveringMuscleIds: ReadonlySet<MuscleId>;
  /** Resolve muscle targets for a template's exercises. */
  getTemplateMuscles: (template: WorkoutTemplate) => MuscleId[];
  lastDoneByTemplate: Record<string, string>;
  limit?: number;
  nowMs?: number;
};

function reasonFor(readyFraction: number, daysSinceLast: number | null): string {
  if (readyFraction >= 0.99) {
    if (daysSinceLast != null && daysSinceLast <= RECENT_WINDOW_DAYS) return 'Ready · recent';
    return 'Ready';
  }
  if (readyFraction >= 0.75) return 'Mostly recovered';
  return 'Partly recovered';
}

/**
 * Rank visible templates by recovered-muscle coverage, with a light recency bias.
 * Skips templates with no known muscles or mostly still recovering.
 */
export function recommendTemplates({
  templates,
  recoveringMuscleIds,
  getTemplateMuscles,
  lastDoneByTemplate,
  limit = 4,
  nowMs = Date.now(),
}: RecommendTemplatesInput): RecommendedTemplate[] {
  const scored: RecommendedTemplate[] = [];

  for (const template of templates) {
    const muscles = [...new Set(getTemplateMuscles(template))];
    if (muscles.length === 0) continue;

    const readyCount = muscles.filter((m) => !recoveringMuscleIds.has(m)).length;
    const readyFraction = readyCount / muscles.length;
    if (readyFraction < MIN_READY_FRACTION) continue;

    const lastDone = lastDoneByTemplate[template.id];
    const daysSinceLast = lastDone
      ? (nowMs - new Date(lastDone).getTime()) / DAY_MS
      : null;

    let score = readyFraction * 100;
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
      reason: reasonFor(readyFraction, daysSinceLast),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name))
    .slice(0, limit);
}
