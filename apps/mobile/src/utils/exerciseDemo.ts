import type { Exercise } from '@muscleos/types';

import { isCustomExerciseId } from '@/utils/exerciseIds';

/**
 * The exercise's page on muscleos.app: an animated demo where one exists, otherwise the same
 * how-to with "Demo coming soon". Every published catalog exercise has a page, so the app needs no
 * list of which demos exist. Customs and unpublished catalog rows have no page.
 */
export function exercisePageUrl(exercise: Pick<Exercise, 'id' | 'isPublished'>): string | undefined {
  if (isCustomExerciseId(exercise.id) || exercise.isPublished === false) return undefined;
  return `https://muscleos.app/exercises/${exercise.id}`;
}
