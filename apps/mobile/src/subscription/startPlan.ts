import type { WorkoutTemplate } from '@muscleos/types';
import { parseStartParams, type StartWorkoutParams } from '@/store/activeWorkoutLogic';
import { resolveTemplateExercises, type ResolvedTemplateExercise } from '@/utils/templateExercises';

/**
 * The exercise plan a start-from-params workout uses, once `startFromParamsDecision` says `'start'`.
 *
 * On Basic the only thing that can start is a known built-in template, and its plan always comes
 * from the template itself: URL `exerciseIds` / `sets` are ignored, so a built-in id can't be used
 * to smuggle an arbitrary (ad-hoc) exercise list past the `empty_workout` gate. Pro uses the plan in
 * the URL (what the home screen and preview encode), falling back to the template when the link
 * carries no exercises.
 */
export function startPlanFromParams(args: {
  isPro: boolean;
  template: Pick<WorkoutTemplate, 'exerciseIds' | 'exercises' | 'defaultSets'> | undefined;
  params: StartWorkoutParams;
}): ResolvedTemplateExercise[] {
  const fromUrl = parseStartParams(args.params);
  if (!args.template) return fromUrl;
  if (!args.isPro || fromUrl.length === 0) return resolveTemplateExercises(args.template);
  return fromUrl;
}
