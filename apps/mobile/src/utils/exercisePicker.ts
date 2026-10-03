import type { Exercise } from '@muscleos/types';
import { searchExercises } from '@/utils/exerciseSearch';

/**
 * Rows for the active workout's Add / Replace exercise picker
 * (docs/features/workout-logging.md#mid-workout-edits): the catalog plus customs, ranked by the
 * shared exercise search, minus every exercise already in the workout — so the picker can never
 * add a duplicate. An empty query keeps the catalog order.
 */
export function pickerResults(
  all: readonly Exercise[],
  query: string,
  excludeIds: Iterable<string>
): Exercise[] {
  const exclude = new Set(excludeIds);
  return searchExercises(
    all.filter((e) => !exclude.has(e.id)),
    query
  );
}

/** What the picker list shows below its results for the current search text. */
export function pickerFooter(
  query: string,
  resultCount: number
): {
  /** "No matching exercises" — a search with text found nothing. */
  showNoMatches: boolean;
  /** The `Create "<query>"` row's name, offered whenever the search box has text. */
  createName: string | null;
} {
  const trimmed = query.trim();
  return {
    showNoMatches: trimmed !== '' && resultCount === 0,
    createName: trimmed === '' ? null : trimmed,
  };
}
