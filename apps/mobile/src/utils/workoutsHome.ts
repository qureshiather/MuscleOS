import type { MuscleId, WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import type { ProFeature } from '@/subscription/features';
import { requiresProToStart } from '@/subscription/features';
import { type RecommendedTemplate, recommendTemplates } from '@/utils/recommendTemplates';

/**
 * Rules behind the Workouts (home) tab — docs/features/templates.md#home-screen. The screen imports
 * these so section visibility, defaults, and start routing are testable without a renderer.
 */

/** Home "Suggested" grid cap. */
export const SUGGESTED_TEMPLATES_LIMIT = 2;

/** Collapsible group ids that aren't real folders. */
export const ARCHIVED_SECTION = '_archived';
export const HIDDEN_CUSTOM_SECTION = '_hidden_custom';
export const HIDDEN_BUILT_IN_SECTION = '_hidden_builtin';

/** Real folders start open; the Archived and both Hidden groups start closed. */
export function defaultFolderExpanded(folderId: string): boolean {
  return (
    folderId !== ARCHIVED_SECTION &&
    folderId !== HIDDEN_CUSTOM_SECTION &&
    folderId !== HIDDEN_BUILT_IN_SECTION
  );
}

type CustomCounts = { isPro: boolean; visibleCustom: number; hiddenCustom: number };

/** The Custom section shows for Pro, or for anyone who owns a custom template (hidden ones count). */
export function customSectionVisible({ isPro, visibleCustom, hiddenCustom }: CustomCounts): boolean {
  return isPro || visibleCustom + hiddenCustom > 0;
}

/** Lapsed Pro: Basic with any saved custom template, hidden ones included. */
export function showLapsedNotice({ isPro, visibleCustom, hiddenCustom }: CustomCounts): boolean {
  return !isPro && visibleCustom + hiddenCustom > 0;
}

/** Most recent `completedAt` per template id; sessions without one are ignored. */
export function lastDoneByTemplate(
  sessions: readonly Pick<WorkoutSession, 'templateId' | 'completedAt'>[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of sessions) {
    const completedAt = s.completedAt;
    if (completedAt == null) continue;
    const prev = map[s.templateId];
    if (prev == null || completedAt > prev) map[s.templateId] = completedAt;
  }
  return map;
}

/** Templates this tier can start: everything on Pro, built-ins only on Basic. */
export function startableTemplates(
  templates: readonly WorkoutTemplate[],
  isPro: boolean
): WorkoutTemplate[] {
  return isPro ? [...templates] : templates.filter((t) => !requiresProToStart(t));
}

/**
 * Home "Suggested": `recommendTemplates` over the visible templates this tier can start, capped at
 * 2. Basic users are never suggested a custom template they can't run.
 */
export function suggestHomeTemplates(args: {
  templates: readonly WorkoutTemplate[];
  isPro: boolean;
  isHidden: (template: WorkoutTemplate) => boolean;
  recoveringMuscleIds: ReadonlySet<MuscleId>;
  recentlyWorkedMuscleIds: ReadonlySet<MuscleId>;
  lastDoneByTemplate: Record<string, string>;
  getTemplateMuscles: (template: WorkoutTemplate) => MuscleId[];
  nowMs?: number;
}): RecommendedTemplate[] {
  return recommendTemplates({
    templates: startableTemplates(args.templates, args.isPro).filter((t) => !args.isHidden(t)),
    recoveringMuscleIds: args.recoveringMuscleIds,
    recentlyWorkedMuscleIds: args.recentlyWorkedMuscleIds,
    lastDoneByTemplate: args.lastDoneByTemplate,
    getTemplateMuscles: args.getTemplateMuscles,
    limit: SUGGESTED_TEMPLATES_LIMIT,
    nowMs: args.nowMs,
  });
}

export type TemplateStartDecision =
  | `paywall:${ProFeature}`
  | 'resume-prompt'
  | 'preview'
  | 'active-workout';

/**
 * Where tapping a template card or the Empty workout hero leads. Basic + a template that
 * `requiresProToStart` → paywall (`custom_templates`); Basic + empty → paywall (`empty_workout`);
 * then an in-progress session → the "Workout in progress" prompt; otherwise templates open the
 * preview and the empty workout goes straight to `/active-workout`.
 */
export function decideTemplateStart(args: {
  isPro: boolean;
  template: Pick<WorkoutTemplate, 'isBuiltIn'> | 'empty';
  hasActiveSession: boolean;
}): TemplateStartDecision {
  const { isPro, template, hasActiveSession } = args;
  if (template === 'empty') {
    if (!isPro) return 'paywall:empty_workout';
    return hasActiveSession ? 'resume-prompt' : 'active-workout';
  }
  if (!isPro && requiresProToStart(template)) return 'paywall:custom_templates';
  return hasActiveSession ? 'resume-prompt' : 'preview';
}
