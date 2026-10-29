import type { Exercise } from '@muscleos/types';
import { buildExerciseAliasMap } from '@/utils/exerciseSearch';

/** Custom exercises have no flag; they are identified by the `custom_` id prefix. */
export function isCustomExerciseId(id: string): boolean {
  return id.startsWith('custom_');
}

/**
 * A new custom exercise id: `custom_<time>_<random>` (base 36). Customs sync between devices and
 * accounts, so a per-device counter (`custom_<n>`, still valid for older customs) could hand one
 * device's id to another device's exercise. Pass retired customs too: an id past sessions still
 * reference must never go to a new exercise.
 */
export function nextCustomExerciseId(
  custom: readonly Pick<Exercise, 'id'>[],
  now: number = Date.now(),
  random: () => number = Math.random
): string {
  const taken = new Set(custom.map((e) => e.id));
  for (;;) {
    const id = `custom_${now.toString(36)}_${random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    if (!taken.has(id)) return id;
  }
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
