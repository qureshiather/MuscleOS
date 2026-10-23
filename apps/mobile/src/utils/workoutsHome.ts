import type { MuscleId, WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import { recommendTemplates } from '@/utils/recommendTemplates';

/**
 * Rules behind the Workouts (home) tab — docs/features/templates.md#home-screen. The screen imports
 * these so section visibility, defaults, and start routing are testable without a renderer.
 */

/** Home "Suggested" grid cap. */
export const SUGGESTED_TEMPLATES_LIMIT = 2;

/** Collapsible group ids that aren't real folders. */
export const ARCHIVED_SECTION = '_archived';
export const HIDDEN_CUSTOM_SECTION = '_hidden_custom';

/** Real folders start open; the Archived and Hidden groups start closed. */
export function defaultFolderExpanded(folderId: string): boolean {
  return folderId !== ARCHIVED_SECTION && folderId !== HIDDEN_CUSTOM_SECTION;
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

/**
 * Home "Suggested": `recommendTemplates` over Your workouts, capped at 2. Recovery decides what to
 * target next; a program only adds its days to the pool.
 */
export function suggestHomeTemplates(args: {
  /** Your workouts (`yourWorkoutTemplates()`): the chosen program's templates and visible customs. */
  templates: readonly WorkoutTemplate[];
  recoveringMuscleIds: ReadonlySet<MuscleId>;
  recentlyWorkedMuscleIds: ReadonlySet<MuscleId>;
  lastDoneByTemplate: Record<string, string>;
  getTemplateMuscles: (template: WorkoutTemplate) => MuscleId[];
  nowMs?: number;
}): { template: WorkoutTemplate }[] {
  return recommendTemplates({
    templates: [...args.templates],
    recoveringMuscleIds: args.recoveringMuscleIds,
    recentlyWorkedMuscleIds: args.recentlyWorkedMuscleIds,
    lastDoneByTemplate: args.lastDoneByTemplate,
    getTemplateMuscles: args.getTemplateMuscles,
    limit: SUGGESTED_TEMPLATES_LIMIT,
    nowMs: args.nowMs,
  }).map((r) => ({ template: r.template }));
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
