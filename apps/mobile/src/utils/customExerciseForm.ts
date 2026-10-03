import type { Equipment, Exercise, ExerciseCategory, MuscleId } from '@muscleos/types';
import { isCustomExerciseId } from '@/utils/exerciseIds';

/**
 * The exercise `/create-exercise?id=` should edit. Only custom exercises are editable; any other
 * id (a catalog exercise, an alias, an unknown id) opens an empty create form instead of
 * prefilling, and then cloning, someone else's row.
 */
export function resolveExerciseEditTarget(
  id: string | undefined,
  exercise: Exercise | undefined
): Exercise | undefined {
  if (!id || !isCustomExerciseId(id) || !exercise || exercise.id !== id) return undefined;
  return exercise;
}

export interface CustomExerciseForm {
  name: string;
  category: ExerciseCategory | null;
  muscles: MuscleId[];
  equipment: Equipment[];
  instructions: string;
}

export type CustomExerciseFormError = 'name' | 'category' | 'muscles';

export type CustomExerciseDraft =
  | { ok: true; exercise: Omit<Exercise, 'id'> }
  | { ok: false; errors: CustomExerciseFormError[] };

/**
 * Validate the create/edit form: name non-empty after trim (no maximum), a Type, and at least one
 * muscle. Equipment and instructions are optional; blank instructions become `undefined` so an
 * edit can clear them.
 */
export function buildCustomExerciseDraft(form: CustomExerciseForm): CustomExerciseDraft {
  const name = form.name.trim();
  const errors: CustomExerciseFormError[] = [];
  if (!name) errors.push('name');
  if (!form.category) errors.push('category');
  if (form.muscles.length === 0) errors.push('muscles');
  if (errors.length > 0 || !form.category) return { ok: false, errors };
  return {
    ok: true,
    exercise: {
      name,
      category: form.category,
      muscles: form.muscles,
      equipment: form.equipment,
      instructions: form.instructions.trim() || undefined,
    },
  };
}
