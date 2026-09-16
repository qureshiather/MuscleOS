import type { Exercise } from '@muscleos/types';

export function mergeCatalogById(base: Exercise[], incoming: Exercise[]): Exercise[] {
  const map = new Map(base.map((e) => [e.id, e]));
  for (const exercise of incoming) {
    map.set(exercise.id, exercise);
  }
  return Array.from(map.values());
}

/**
 * Overlay a newer bundled seed onto the cached catalog.
 * Seed fields win (names, muscles, category); cached instructions are kept when
 * the seed omits them. Cache-only ids (from a later delta) are retained.
 */
export function applyCatalogSeed(seed: Exercise[], cache: Exercise[]): Exercise[] {
  const cachedById = new Map(cache.map((exercise) => [exercise.id, exercise]));
  const seen = new Set<string>();
  const next: Exercise[] = [];

  for (const row of seed) {
    seen.add(row.id);
    const previous = cachedById.get(row.id);
    if (previous?.instructions && !row.instructions) {
      next.push({ ...row, instructions: previous.instructions });
    } else {
      next.push(row);
    }
  }

  for (const row of cache) {
    if (!seen.has(row.id)) next.push(row);
  }

  return next;
}
