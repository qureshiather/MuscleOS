import type { Exercise, MuscleId, WorkoutTemplate } from '@muscleos/types';
import { muscleLabel } from '@muscleos/types';
import { resolveTemplateExercises } from '@/utils/templateExercises';

/** Muscle pills on a template card. */
export const TEMPLATE_CARD_MUSCLES = 3;

export type TemplateCardModel = {
  /** Exercise names in order, for the card's one-line lineup. */
  exerciseNames: string[];
  /** The main muscle (first listed) of each exercise, de-duplicated in order, capped at 3. */
  muscles: { id: MuscleId; label: string }[];
  /** `3 exercises · 15 sets` */
  meta: string;
};

/** What a Workouts-tab template card shows (docs/features/templates.md#template-cards). */
export function templateCardModel(
  template: Pick<WorkoutTemplate, 'exerciseIds' | 'exercises' | 'defaultSets'>,
  getExercise: (id: string) => Pick<Exercise, 'name' | 'muscles'> | undefined
): TemplateCardModel {
  const resolved = resolveTemplateExercises(template);
  const muscles: MuscleId[] = [];
  const exerciseNames = resolved.map(({ exerciseId }) => {
    const exercise = getExercise(exerciseId);
    const main = exercise?.muscles[0];
    if (main && !muscles.includes(main)) muscles.push(main);
    return exercise?.name ?? exerciseId;
  });
  const n = resolved.length;
  const sets = resolved.reduce((total, e) => total + e.sets, 0);
  return {
    exerciseNames,
    muscles: muscles.slice(0, TEMPLATE_CARD_MUSCLES).map((id) => ({ id, label: muscleLabel(id) })),
    meta: `${n} exercise${n === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`,
  };
}
