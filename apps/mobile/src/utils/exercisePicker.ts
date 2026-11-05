import type { Equipment, Exercise, ExerciseCategory, MuscleId } from '@muscleos/types';
import { searchExercises } from '@/utils/exerciseSearch';
import { MUSCLE_AREAS, type MuscleAreaKey } from '@/utils/muscleAreas';

/** Equipment chips, in the order the picker offers them. `other` is left out: it narrows to noise. */
export const PICKER_EQUIPMENT: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'ez_bar',
  'cable',
  'machine',
  'band',
  'bodyweight',
];

/** The picker's filters; null means All / Any. They AND together and with the search. */
export interface PickerFilters {
  area: MuscleAreaKey | null;
  category: ExerciseCategory | null;
  equipment: Equipment | null;
  /** Template editor only: exercises whose main muscle the template doesn't train yet. */
  newMusclesOnly: boolean;
}

export const NO_PICKER_FILTERS: PickerFilters = {
  area: null,
  category: null,
  equipment: null,
  newMusclesOnly: false,
};

export interface PickerOptions {
  filters?: PickerFilters;
  /** Muscles the template already trains, for **New muscles only**. */
  covered?: ReadonlySet<MuscleId>;
  /**
   * Exercises added during this visit. They stay listed (shown as added, so a tap can undo) even
   * though they are now in the workout and their muscles count as covered.
   */
  keepIds?: ReadonlySet<string>;
}

/** The first-listed muscle is the exercise's main one; the rest are what it also works. */
export function exerciseMuscleSplit(muscles: readonly MuscleId[]): { main: MuscleId | null; also: MuscleId[] } {
  return { main: muscles[0] ?? null, also: muscles.slice(1) };
}

function matchesFilters(exercise: Exercise, filters: PickerFilters, covered: ReadonlySet<MuscleId>, kept: boolean): boolean {
  if (filters.area) {
    const area = MUSCLE_AREAS.find((a) => a.key === filters.area);
    if (area && !exercise.muscles.some((m) => area.muscles.includes(m))) return false;
  }
  if (filters.category && exercise.category !== filters.category) return false;
  if (filters.equipment && !exercise.equipment.includes(filters.equipment)) return false;
  if (filters.newMusclesOnly && !kept) {
    const main = exercise.muscles[0];
    if (!main || covered.has(main)) return false;
  }
  return true;
}

/**
 * Rows for the exercise picker (docs/features/exercise-library.md#exercise-pickers): the catalog
 * plus customs, ranked by the shared exercise search, minus every exercise already in the workout
 * (except those added during this visit) — so the picker can never add a duplicate — then
 * narrowed by the filters. An empty query keeps the catalog order.
 */
export function pickerResults(
  all: readonly Exercise[],
  query: string,
  excludeIds: Iterable<string>,
  options: PickerOptions = {}
): Exercise[] {
  const keep = options.keepIds ?? new Set<string>();
  const exclude = new Set([...excludeIds].filter((id) => !keep.has(id)));
  const filters = options.filters ?? NO_PICKER_FILTERS;
  const covered = options.covered ?? new Set<MuscleId>();
  return searchExercises(
    all.filter((e) => !exclude.has(e.id)),
    query
  ).filter((e) => matchesFilters(e, filters, covered, keep.has(e.id)));
}

/** How many of the Type / Equipment / Muscle filters are set — the reset link shows when any are. */
export function activePickerFilterCount(filters: PickerFilters): number {
  return [filters.area, filters.category, filters.equipment].filter((f) => f != null).length + (filters.newMusclesOnly ? 1 : 0);
}

/** What the picker list shows below its results for the current search text and filters. */
export function pickerFooter(
  query: string,
  resultCount: number,
  filtered = false
): {
  /** Shown in place of an empty list: a search with text, or a filter, found nothing. */
  emptyMessage: string | null;
  /** The `Create "<query>"` row's name, offered whenever the search box has text. */
  createName: string | null;
} {
  const trimmed = query.trim();
  let emptyMessage: string | null = null;
  if (resultCount === 0 && trimmed !== '') emptyMessage = 'No matching exercises';
  else if (resultCount === 0 && filtered) emptyMessage = 'No exercises match these filters';
  return { emptyMessage, createName: trimmed === '' ? null : trimmed };
}
