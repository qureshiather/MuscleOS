import type { Exercise } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { CATALOG_SEED } from '@/data/catalogSeed';
import { nextCustomExerciseId, resolveExerciseById, retireExercise } from './exerciseIds';

const custom = (id: string): Exercise => ({
  id,
  name: id,
  muscles: ['chest'],
  equipment: [],
  category: 'free_weight',
});

describe('nextCustomExerciseId', () => {
  const NOW = Date.UTC(2026, 9, 28);

  it('is custom_<time>_<random>, so two devices never mint the same id from a counter', () => {
    const id = nextCustomExerciseId([], NOW, () => 0.123456789);
    expect(id).toBe(`custom_${NOW.toString(36)}_${(0.123456789).toString(36).slice(2, 8)}`);
    expect(id).toMatch(/^custom_[0-9a-z]+_[0-9a-z]{6}$/);
    // Two devices creating a custom in the same millisecond still differ by the random part.
    expect(nextCustomExerciseId([], NOW, () => 0.5)).not.toBe(nextCustomExerciseId([], NOW, () => 0.25));
  });

  it('never returns an id already taken by a live or retired custom', () => {
    const rolls = [0.5, 0.5, 0.75];
    const first = nextCustomExerciseId([], NOW, () => 0.5);
    const id = nextCustomExerciseId([custom(first)], NOW, () => rolls.shift() ?? 0.9);
    expect(id).not.toBe(first);
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

  it('falls back to retired (deleted) customs, after live ones', () => {
    const retired = [{ ...custom('custom_3'), name: 'Old' }];
    expect(resolveExerciseById('custom_3', CATALOG_SEED, [], retired)?.name).toBe('Old');
    expect(resolveExerciseById('custom_3', CATALOG_SEED, [{ ...custom('custom_3'), name: 'Live' }], retired)?.name).toBe(
      'Live'
    );
  });
});

describe('retireExercise', () => {
  it('appends, replacing an older copy with the same id', () => {
    const once = retireExercise([], { ...custom('custom_1'), name: 'A' });
    const twice = retireExercise([...once, custom('custom_2')], { ...custom('custom_1'), name: 'B' });
    expect(twice.map((e) => [e.id, e.name])).toEqual([
      ['custom_2', custom('custom_2').name],
      ['custom_1', 'B'],
    ]);
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
