import type { Exercise, ExerciseCategory, MuscleId } from '@muscleos/types';
import { EXERCISE_CATEGORY_LABELS, equipmentLabel, muscleLabel } from '@muscleos/types';
import { isCustomExerciseId } from '@/utils/exerciseIds';
import { searchExercises } from '@/utils/exerciseSearch';
import { muscleArea } from '@/utils/muscleAreas';

/**
 * Coarse muscle groups offered as Muscle filter chips ahead of the 20 individual muscles, shared
 * with the create-exercise form's area shortcuts (`MUSCLE_AREAS`). Chest has no coarse group: it is a
 * single muscle, so the individual Chest chip covers it.
 */
export const LARGE_MUSCLE_GROUPS: Record<string, { label: string; muscles: MuscleId[] }> = {
  legs: muscleArea('legs'),
  back: muscleArea('back'),
  shoulders: muscleArea('shoulders'),
};

/** Everything browsable: published catalog rows in catalog order, then customs. */
export function libraryExercises(catalog: Exercise[], custom: Exercise[]): Exercise[] {
  return [...catalog.filter((e) => e.isPublished !== false), ...custom];
}

/** **All** exercises, the MuscleOS **catalog** only, or **mine**: only the custom exercises you created. */
export type LibrarySource = 'all' | 'catalog' | 'mine';

export interface LibraryFilters {
  query: string;
  /** Omitted = all. */
  source?: LibrarySource;
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

/** Search, then AND the source, Type and Muscle filters. With no query the input order is kept. */
export function filterLibraryExercises(all: Exercise[], filters: LibraryFilters): Exercise[] {
  const pool =
    filters.source === 'mine'
      ? all.filter((e) => isCustomExerciseId(e.id))
      : filters.source === 'catalog'
        ? all.filter((e) => !isCustomExerciseId(e.id))
        : all;
  return searchExercises(pool, filters.query).filter(
    (e) => (!filters.type || e.category === filters.type) && matchesMuscle(e, filters.muscle)
  );
}

export function muscleFilterLabel(muscle: string | null): string {
  if (muscle === null) return 'All';
  return LARGE_MUSCLE_GROUPS[muscle]?.label ?? muscleLabel(muscle as MuscleId);
}

/**
 * Collapsed filter panel summary: only the filters that are on, e.g. `My exercises · Cable · Back`,
 * or null when none are (the panel then shows no summary rather than `All · All`).
 */
export function libraryFilterSummary(
  source: LibrarySource,
  type: ExerciseCategory | null,
  muscle: string | null
): string | null {
  const parts = [
    source === 'mine' ? 'My exercises' : source === 'catalog' ? 'Catalog' : null,
    type === null ? null : EXERCISE_CATEGORY_LABELS[type],
    muscle === null ? null : muscleFilterLabel(muscle),
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The Type line on a library row and in the detail sheet: the category, then any equipment whose
 * label differs from it — `Free Weight · Barbell`, `Cable · Band`, but `Machine`, not
 * `Machine · Machine`.
 */
export function exerciseTypeLine(exercise: Pick<Exercise, 'category' | 'equipment'>): string {
  const category = EXERCISE_CATEGORY_LABELS[exercise.category];
  const extra = exercise.equipment.map(equipmentLabel).filter((label) => label !== category);
  return [category, ...extra].join(' · ');
}
