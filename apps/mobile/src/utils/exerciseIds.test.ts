import type { Exercise } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { CATALOG_SEED } from '@/data/catalogSeed';
import { nextCustomExerciseId, resolveExerciseById } from './exerciseIds';

const custom = (id: string): Exercise => ({
  id,
  name: id,
  muscles: ['chest'],
  equipment: [],
  category: 'free_weight',
});

describe('nextCustomExerciseId', () => {
  it('starts at custom_1', () => {
    expect(nextCustomExerciseId([])).toBe('custom_1');
  });

  it('uses the highest numeric suffix + 1 and never reuses a gap', () => {
    expect(nextCustomExerciseId([custom('custom_1'), custom('custom_7'), custom('custom_3')])).toBe(
      'custom_8'
    );
  });

  it('ignores ids that are not custom_<n>', () => {
    expect(nextCustomExerciseId([custom('custom_x'), custom('bench-press')])).toBe('custom_1');
  });
});

describe('resolveExerciseById', () => {
  it('resolves a legacy catalog slug to the canonical exercise', () => {
    expect(resolveExerciseById('banded-face-pull', CATALOG_SEED, [])?.id).toBe('face-pull');
  });

  it('still resolves unpublished catalog rows so old sessions render', () => {
    expect(resolveExerciseById('rowing-machine', CATALOG_SEED, [])?.isPublished).toBe(false);
  });

  it('finds custom exercises, and returns undefined for unknown ids', () => {
    expect(resolveExerciseById('custom_2', CATALOG_SEED, [custom('custom_2')])?.id).toBe('custom_2');
    expect(resolveExerciseById('custom_9', CATALOG_SEED, [])).toBeUndefined();
  });
});

describe('catalog invariants', () => {
  const ids = new Set(CATALOG_SEED.map((e) => e.id));

  it('has unique ids', () => {
    expect(ids.size).toBe(CATALOG_SEED.length);
  });

  it('never lets an alias shadow a real id', () => {
    const aliases = CATALOG_SEED.flatMap((e) => e.aliases ?? []);
    expect(aliases.filter((a) => ids.has(a))).toEqual([]);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('gives every exercise at least one muscle and never uses the custom_ prefix', () => {
    expect(CATALOG_SEED.filter((e) => e.muscles.length === 0).map((e) => e.id)).toEqual([]);
    expect(CATALOG_SEED.filter((e) => e.id.startsWith('custom_'))).toEqual([]);
  });
});
