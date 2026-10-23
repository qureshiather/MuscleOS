import type { Exercise, MuscleId, WorkoutTemplate } from '@muscleos/types';
import { muscleLabel } from '@muscleos/types';
import { type ResolvedTemplateExercise, resolveTemplateExercises } from '@/utils/templateExercises';

/** Muscle pills on a template card. */
export const TEMPLATE_CARD_MUSCLES = 3;

export type TemplateCardModel = {
  /** The main muscle (first listed) of each exercise, de-duplicated in order, capped at 3. */
  muscles: { id: MuscleId; label: string }[];
  /** `3 exercises`. The preview has the sets, rests and exercise list. */
  meta: string;
};

/** `3 exercises · 15 sets` (working sets) for a resolved plan. */
export function planSizeLabel(plan: readonly Pick<ResolvedTemplateExercise, 'sets'>[]): string {
  const n = plan.length;
  const sets = plan.reduce((total, e) => total + e.sets, 0);
  return `${n} exercise${n === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`;
}

/** What a Workouts-tab template card shows (docs/features/templates.md#template-cards). */
export function templateCardModel(
  template: Pick<WorkoutTemplate, 'exerciseIds' | 'exercises' | 'defaultSets'>,
  getExercise: (id: string) => Pick<Exercise, 'muscles'> | undefined
): TemplateCardModel {
  const resolved = resolveTemplateExercises(template);
  const muscles: MuscleId[] = [];
  for (const { exerciseId } of resolved) {
    const main = getExercise(exerciseId)?.muscles[0];
    if (main && !muscles.includes(main)) muscles.push(main);
  }
  const n = resolved.length;
  return {
    muscles: muscles.slice(0, TEMPLATE_CARD_MUSCLES).map((id) => ({ id, label: muscleLabel(id) })),
    meta: `${n} exercise${n === 1 ? '' : 's'}`,
  };
}
