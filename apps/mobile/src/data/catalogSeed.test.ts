import { describe, expect, it } from 'vitest';
import { CATALOG_SEED, CATALOG_SEED_UPDATED_AT } from './catalogSeed';
import { EXERCISES } from './exercises';

/** Catalog facts stated in docs/features/exercise-library.md#the-catalog. */
describe('bundled catalog seed', () => {
  it('has 399 rows, 396 published', () => {
    expect(CATALOG_SEED).toHaveLength(399);
    expect(CATALOG_SEED.filter((e) => e.isPublished !== false)).toHaveLength(396);
  });

  it('unpublishes exactly the three retired ids', () => {
    expect(
      CATALOG_SEED.filter((e) => e.isPublished === false)
        .map((e) => e.id)
        .sort()
    ).toEqual(['powerlifting-exercises', 'rowing-machine', 'stationary-bike']);
  });

  it('splits 177 free weight / 102 bodyweight / 60 machine / 60 cable', () => {
    const counts: Record<string, number> = {};
    for (const e of CATALOG_SEED) counts[e.category] = (counts[e.category] ?? 0) + 1;
    expect(counts).toEqual({ free_weight: 177, bodyweight: 102, machine: 60, cable: 60 });
  });

  it('carries aliases on 37 rows', () => {
    expect(CATALOG_SEED.filter((e) => (e.aliases ?? []).length > 0)).toHaveLength(37);
  });

  it('bundles instructions for every row, matching the source copy', () => {
    const source = new Map(EXERCISES.map((e) => [e.id, e.instructions]));
    const mismatched = CATALOG_SEED.filter(
      (e) => !e.instructions || e.instructions !== source.get(e.id)
    ).map((e) => e.id);
    expect(mismatched).toEqual([]);
  });

  it('sets no media URLs', () => {
    expect(CATALOG_SEED.some((e) => e.mediaUrl !== undefined)).toBe(false);
  });

  it('stamps an ISO seed date', () => {
    expect(new Date(CATALOG_SEED_UPDATED_AT).toISOString()).toBe(CATALOG_SEED_UPDATED_AT);
  });
});
