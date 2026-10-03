import type { Exercise } from '@muscleos/types';
import { buildExerciseAliasMap } from '@/utils/exerciseSearch';

/** Custom exercises have no flag; they are identified by the `custom_` id prefix. */
export function isCustomExerciseId(id: string): boolean {
  return id.startsWith('custom_');
}

/**
 * Custom exercise ids are `custom_<n>`, n = highest numeric suffix + 1 (gaps aren't reused). Pass
 * retired customs too: an id past sessions still reference must never go to a new exercise.
 */
export function nextCustomExerciseId(custom: Exercise[]): string {
  const max = custom.reduce((acc, e) => {
    const m = e.id.match(/^custom_(\d+)$/);
    return m ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `custom_${max + 1}`;
}

/**
 * Look up an exercise by id, resolving legacy catalog slugs through `aliases` first so renamed
 * catalog exercises don't orphan old sessions. Unpublished rows still resolve.
 */
export function resolveExerciseById(
  id: string,
  catalog: Exercise[],
  custom: Exercise[],
  retired: Exercise[] = []
): Exercise | undefined {
  const resolved = buildExerciseAliasMap(catalog).get(id) ?? id;
  return (
    catalog.find((e) => e.id === resolved) ??
    custom.find((e) => e.id === resolved || e.id === id) ??
    retired.find((e) => e.id === id)
  );
}

/** Adds a deleted custom to the retired list, replacing an older copy with the same id. */
export function retireExercise(retired: readonly Exercise[], exercise: Exercise): Exercise[] {
  return [...retired.filter((e) => e.id !== exercise.id), exercise];
}
