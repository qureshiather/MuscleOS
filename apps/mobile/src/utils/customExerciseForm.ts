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

/**
 * Equipment the form offers under each Type. Type already names the cable, machine and bodyweight
 * equipment, so those never appear as a second chip; the lists follow the catalog's equipment →
 * Type table (bands count as Cable). Machine and Bodyweight have nothing left to add.
 */
export const EQUIPMENT_FOR_CATEGORY: Record<ExerciseCategory, Equipment[]> = {
  free_weight: ['barbell', 'dumbbell', 'kettlebell', 'ez_bar', 'other'],
  cable: ['band'],
  machine: [],
  bodyweight: [],
};

/**
 * Equipment chips to show: the Type's options, plus anything an edited custom already has outside
 * them (older customs could pick any equipment) so it can still be deselected. Equipment named by
 * the Type itself stays hidden.
 */
export function equipmentOptions(
  category: ExerciseCategory | null,
  selected: readonly Equipment[]
): Equipment[] {
  if (!category) return [];
  const options = EQUIPMENT_FOR_CATEGORY[category];
  const extras = selected.filter((e) => !options.includes(e) && e !== category);
  return [...options, ...extras];
}

/** Changing Type drops equipment that doesn't fit the new one. */
export function equipmentForCategory(
  category: ExerciseCategory,
  equipment: readonly Equipment[]
): Equipment[] {
  return equipment.filter((e) => EQUIPMENT_FOR_CATEGORY[category].includes(e));
}

const MISSING_FIELD_COPY: Record<CustomExerciseFormError, string> = {
  name: 'a name',
  category: 'a type',
  muscles: 'a muscle',
};

/** Hint under the disabled Save button: `Add a name, a type and a muscle to save.` */
export function missingFieldsHint(errors: readonly CustomExerciseFormError[]): string | null {
  if (errors.length === 0) return null;
  const parts = errors.map((e) => MISSING_FIELD_COPY[e]);
  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Add ${list} to save.`;
}
