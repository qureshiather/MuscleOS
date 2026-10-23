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
 * The program day to do next: the one after the most recently finished day, in shipped order and
 * wrapping (B after A, A after B), or day 1 when none was done. Undefined for no program.
 */
export function nextProgramDay(
  days: readonly WorkoutTemplate[],
  lastDone: Record<string, string>
): WorkoutTemplate | undefined {
  if (days.length === 0) return undefined;
  let latest = -1;
  for (let i = 0; i < days.length; i++) {
    const at = lastDone[days[i].id];
    if (at != null && (latest < 0 || at > lastDone[days[latest].id])) latest = i;
  }
  return days[(latest + 1) % days.length];
}

/**
 * Home "Suggested", capped at 2: the chosen program's next day always leads (following a program
 * means doing its next workout, recovered or not), then `recommendTemplates` over the rest of Your
 * workouts.
 */
export function suggestHomeTemplates(args: {
  /** Your workouts (`yourWorkoutTemplates()`): the chosen program's templates and visible customs. */
  templates: readonly WorkoutTemplate[];
  /** The chosen program's days in shipped order; empty or omitted for no program. */
  programDays?: readonly WorkoutTemplate[];
  recoveringMuscleIds: ReadonlySet<MuscleId>;
  recentlyWorkedMuscleIds: ReadonlySet<MuscleId>;
  lastDoneByTemplate: Record<string, string>;
  getTemplateMuscles: (template: WorkoutTemplate) => MuscleId[];
  nowMs?: number;
}): { template: WorkoutTemplate }[] {
  const next = nextProgramDay(args.programDays ?? [], args.lastDoneByTemplate);
  const recommended = recommendTemplates({
    templates: args.templates.filter((t) => t.id !== next?.id),
    recoveringMuscleIds: args.recoveringMuscleIds,
    recentlyWorkedMuscleIds: args.recentlyWorkedMuscleIds,
    lastDoneByTemplate: args.lastDoneByTemplate,
    getTemplateMuscles: args.getTemplateMuscles,
    limit: SUGGESTED_TEMPLATES_LIMIT - (next ? 1 : 0),
    nowMs: args.nowMs,
  });
  return [...(next ? [{ template: next }] : []), ...recommended.map((r) => ({ template: r.template }))];
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
