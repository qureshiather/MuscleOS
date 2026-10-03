import type { Exercise, ExerciseCategory, MuscleId } from '@muscleos/types';
import { EXERCISE_CATEGORY_LABELS, muscleLabel } from '@muscleos/types';
import { searchExercises } from '@/utils/exerciseSearch';

/**
 * Coarse muscle groups offered as Muscle filter chips ahead of the 18 individual muscles. Chest
 * has no coarse group: it is a single muscle, so the individual Chest chip covers it.
 */
export const LARGE_MUSCLE_GROUPS: Record<string, { label: string; muscles: MuscleId[] }> = {
  legs: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
  back: { label: 'Back', muscles: ['lats', 'traps', 'lower_back', 'rhomboids'] },
  shoulders: { label: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
};

export interface LibraryFilters {
  query: string;
  /** null = All */
  type: ExerciseCategory | null;
  /** A LARGE_MUSCLE_GROUPS key, a MuscleId, or null = All */
  muscle: string | null;
}

function matchesMuscle(exercise: Exercise, muscle: string | null): boolean {
  if (!muscle) return true;
  const group = LARGE_MUSCLE_GROUPS[muscle];
  if (group) return exercise.muscles.some((m) => group.muscles.includes(m));
  return exercise.muscles.includes(muscle as MuscleId);
}

/** Search, then AND the Type and Muscle filters. With no query the input order is kept. */
export function filterLibraryExercises(all: Exercise[], filters: LibraryFilters): Exercise[] {
  return searchExercises(all, filters.query).filter(
    (e) => (!filters.type || e.category === filters.type) && matchesMuscle(e, filters.muscle)
  );
}

export function muscleFilterLabel(muscle: string | null): string {
  if (muscle === null) return 'All';
  return LARGE_MUSCLE_GROUPS[muscle]?.label ?? muscleLabel(muscle as MuscleId);
}

/** Collapsed filter panel summary: `<Type> · <Muscle>`, e.g. `All · All`, `Cable · Back`. */
export function libraryFilterSummary(type: ExerciseCategory | null, muscle: string | null): string {
  const typeLabel = type === null ? 'All' : EXERCISE_CATEGORY_LABELS[type];
  return `${typeLabel} · ${muscleFilterLabel(muscle)}`;
}
