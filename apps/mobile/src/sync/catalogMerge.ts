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
 * Seed fields win (names, muscles, category, instructions); cached instructions are kept only
 * for rows where the seed has none. Cache-only ids (from a later delta) are retained.
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

export interface CatalogCacheSnapshot {
  exercises: Exercise[];
  watermark: string | null;
  seedAppliedAt: string | null;
}

export interface CatalogReconcileResult {
  catalog: Exercise[];
  watermark: string;
  /** Cache to persist, or null when the stored cache is already current. */
  write: { exercises: Exercise[]; watermark: string; seedAppliedAt: string } | null;
}

/**
 * Decide the catalog to show at launch from the stored cache and the bundled seed. The seed is
 * applied when the cache is empty, has never had a seed applied, or was seeded from an older
 * binary; the watermark then moves up to the seed date (never down).
 */
export function reconcileCatalogCache(
  cache: CatalogCacheSnapshot,
  seed: Exercise[],
  seedUpdatedAt: string
): CatalogReconcileResult {
  let watermark = cache.watermark ?? seedUpdatedAt;
  const seedNeedsApply =
    !cache.seedAppliedAt || cache.seedAppliedAt < seedUpdatedAt || cache.exercises.length === 0;
  if (!seedNeedsApply) return { catalog: cache.exercises, watermark, write: null };

  const catalog = applyCatalogSeed(seed, cache.exercises);
  if (seedUpdatedAt > watermark) watermark = seedUpdatedAt;
  return { catalog, watermark, write: { exercises: catalog, watermark, seedAppliedAt: seedUpdatedAt } };
}

/** The highest `updated_at` among delta rows, or the current watermark when none is later. */
export function advanceWatermark(rows: { updated_at?: unknown }[], watermark: string): string {
  let next = watermark;
  for (const row of rows) {
    const updatedAt = row.updated_at;
    if (typeof updatedAt === 'string' && updatedAt > next) next = updatedAt;
  }
  return next;
}
