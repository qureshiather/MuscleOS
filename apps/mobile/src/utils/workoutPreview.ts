import type { WorkoutTemplate } from '@muscleos/types';
import { formatWeight, type WeightUnit } from '@/utils/weightUnits';
import { resolveTemplateExercises, type ResolvedTemplateExercise } from '@/utils/templateExercises';
import type { StartWorkoutParams } from '@/store/activeWorkoutLogic';
import { startPlanFromParams } from '@/utils/workoutStart';

/**
 * Workout preview helpers (docs/features/templates.md#workout-preview).
 */

/** Seconds as `m:ss` — the preview's rest badge shows the app default (120 → `2:00`). */
export function formatRestDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * The card's Previous line, `Previous: <weight> × <reps>` in the display unit, or null (the line is
 * omitted) when there is no previous for the exercise. Reps are dropped when unknown.
 */
export function formatPrevious(
  prev: { weightKg: number; reps?: number } | null | undefined,
  unit: WeightUnit
): string | null {
  if (prev == null) return null;
  const reps = prev.reps != null ? ` × ${prev.reps}` : '';
  return `Previous: ${formatWeight(prev.weightKg, unit)}${reps}`;
}

export type PreviewEntryState = 'missing' | 'active-session' | 'ready';

/**
 * Entry guards: no template id or no exercises → "Missing workout
 * details"; a workout already in progress → redirect to `/active-workout`.
 */
export function previewEntryState(args: {
  templateId: string;
  exerciseIds: readonly string[];
  hasActiveSession: boolean;
}): PreviewEntryState {
  if (args.hasActiveSession) return 'active-session';
  if (!args.templateId || args.exerciseIds.length === 0) return 'missing';
  return 'ready';
}

/**
 * The plan the preview shows and starts: the plan the link encodes, falling back to the template's
 * own. Once Edit has been opened from the preview (`followTemplate`), a resolved template's current
 * plan wins, so returning from the editor shows the saved changes rather than the stale link.
 */
export function previewPlan(args: {
  template: Pick<WorkoutTemplate, 'exerciseIds' | 'exercises' | 'defaultSets'> | undefined;
  params: StartWorkoutParams;
  followTemplate: boolean;
}): ResolvedTemplateExercise[] {
  if (args.followTemplate && args.template) return resolveTemplateExercises(args.template);
  return startPlanFromParams(args);
}

/** Only your own templates can be edited from the preview; built-ins are immutable. */
export function canEditFromPreview(
  template: Pick<WorkoutTemplate, 'isBuiltIn'> | undefined
): boolean {
  return template != null && template.isBuiltIn !== true;
}
