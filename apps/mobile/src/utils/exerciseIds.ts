import type { Exercise } from '@muscleos/types';
import { buildExerciseAliasMap } from '@/utils/exerciseSearch';

/** Custom exercise ids are `custom_<n>`, n = highest existing numeric suffix + 1 (gaps aren't reused). */
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
  custom: Exercise[]
): Exercise | undefined {
  const resolved = buildExerciseAliasMap(catalog).get(id) ?? id;
  return catalog.find((e) => e.id === resolved) ?? custom.find((e) => e.id === resolved || e.id === id);
}
