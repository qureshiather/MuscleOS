import type { WorkoutTemplate } from '@muscleos/types';
import { parseStartParams, type StartWorkoutParams } from '@/store/activeWorkoutLogic';
import { resolveTemplateExercises, type ResolvedTemplateExercise } from '@/utils/templateExercises';

/** Template id the home screen uses for an empty / ad-hoc workout. */
export const EMPTY_WORKOUT_TEMPLATE_ID = '_empty';

/**
 * Whether the start-from-params path in `/active-workout` (also reached by deep link and
 * notification tap) should start a workout yet. It waits while a workout is in progress (or not yet
 * read back) and until templates have loaded, so a custom template is never mistaken for an
 * unknown id.
 */
export function startFromParamsDecision(args: {
  hasSession: boolean;
  templatesLoaded: boolean;
  templateId: string;
}): 'wait' | 'start' {
  if (args.hasSession || !args.templateId || !args.templatesLoaded) return 'wait';
  return 'start';
}

/**
 * The exercise plan a start-from-params workout uses: the plan in the URL (what the home screen and
 * preview encode), falling back to the template when the link carries no exercises. An unknown id
 * or `_empty` starts with whatever the URL carries (usually nothing — an empty workout).
 */
export function startPlanFromParams(args: {
  template: Pick<WorkoutTemplate, 'exerciseIds' | 'exercises' | 'defaultSets'> | undefined;
  params: StartWorkoutParams;
}): ResolvedTemplateExercise[] {
  const fromUrl = parseStartParams(args.params);
  if (args.template && fromUrl.length === 0) return resolveTemplateExercises(args.template);
  return fromUrl;
}
