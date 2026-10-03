import type { WorkoutTemplate } from '@muscleos/types';
import {
  type ResolvedTemplateExercise,
  serializeTemplateExercises,
} from '@/utils/templateExercises';

/**
 * Create / edit template rules (docs/features/templates.md#creating-and-editing), kept out of
 * `app/create-template.tsx` so they're unit-testable.
 */

export const TEMPLATE_NAME_REQUIRED = 'Name is required';
export const TEMPLATE_EXERCISES_REQUIRED = 'Add at least one exercise';

export type TemplateDraftErrors = {
  name: string | null;
  exercises: string | null;
  valid: boolean;
};

/** Name must be non-empty after trim; at least one exercise. No max length or exercise cap. */
export function validateTemplateDraft(
  name: string,
  plan: readonly ResolvedTemplateExercise[]
): TemplateDraftErrors {
  const nameError = name.trim() ? null : TEMPLATE_NAME_REQUIRED;
  const exercisesError = plan.length > 0 ? null : TEMPLATE_EXERCISES_REQUIRED;
  return { name: nameError, exercises: exercisesError, valid: !nameError && !exercisesError };
}

/** `tpl_<timestamp>_<random>` — `rand` is the caller's random suffix. */
export function newTemplateId(now: number, rand: string): string {
  return `tpl_${now}_${rand}`;
}

export type TemplateSave =
  | { kind: 'update'; id: string; patch: Partial<WorkoutTemplate> }
  | { kind: 'create'; template: WorkoutTemplate }
  | { kind: 'not-found' };

/**
 * What saving the form does. Edit mode with no matching **custom** template (unknown id, or a
 * built-in id) is `not-found` — never a silent create. In edit mode the chosen folder is always
 * written, so picking **None** clears an existing folder.
 */
export function buildTemplateSave(args: {
  existing: WorkoutTemplate | null | undefined;
  isEditMode: boolean;
  name: string;
  plan: readonly ResolvedTemplateExercise[];
  folderId: string | undefined;
  now: number;
  rand: string;
}): TemplateSave {
  const { existing, isEditMode, plan, folderId } = args;
  const name = args.name.trim();
  const payload = serializeTemplateExercises(plan);
  if (isEditMode) {
    if (existing == null || existing.isBuiltIn) return { kind: 'not-found' };
    return { kind: 'update', id: existing.id, patch: { name, ...payload, folderId } };
  }
  return {
    kind: 'create',
    template: {
      id: newTemplateId(args.now, args.rand),
      name,
      isBuiltIn: false,
      ...payload,
      ...(folderId && { folderId }),
    },
  };
}
