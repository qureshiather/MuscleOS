import type { MuscleId, WorkoutSession, WorkoutTemplate } from '@muscleos/types';
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

/** Home "Suggested": `recommendTemplates` over the visible templates, capped at 2. */
export function suggestHomeTemplates(args: {
  templates: readonly WorkoutTemplate[];
  isHidden: (template: WorkoutTemplate) => boolean;
  recoveringMuscleIds: ReadonlySet<MuscleId>;
  recentlyWorkedMuscleIds: ReadonlySet<MuscleId>;
  lastDoneByTemplate: Record<string, string>;
  getTemplateMuscles: (template: WorkoutTemplate) => MuscleId[];
  nowMs?: number;
}): RecommendedTemplate[] {
  return recommendTemplates({
    templates: args.templates.filter((t) => !args.isHidden(t)),
    recoveringMuscleIds: args.recoveringMuscleIds,
    recentlyWorkedMuscleIds: args.recentlyWorkedMuscleIds,
    lastDoneByTemplate: args.lastDoneByTemplate,
    getTemplateMuscles: args.getTemplateMuscles,
    limit: SUGGESTED_TEMPLATES_LIMIT,
    nowMs: args.nowMs,
  });
}

export type TemplateStartDecision = 'resume-prompt' | 'preview' | 'active-workout';

/**
 * Where tapping a template card or the Empty workout hero leads: an in-progress session → the
 * "Workout in progress" prompt; otherwise templates open the preview and the empty workout goes
 * straight to `/active-workout`.
 */
export function decideTemplateStart(args: {
  template: Pick<WorkoutTemplate, 'isBuiltIn'> | 'empty';
  hasActiveSession: boolean;
}): TemplateStartDecision {
  if (args.hasActiveSession) return 'resume-prompt';
  return args.template === 'empty' ? 'active-workout' : 'preview';
}
