import { describe, expect, it } from 'vitest';
import type { Exercise } from '@muscleos/types';
import { applyCatalogSeed, mergeCatalogById } from './catalogMerge';

const bench: Exercise = {
  id: 'bench-press',
  name: 'Barbell Bench Press',
  muscles: ['chest'],
  equipment: ['barbell'],
  category: 'free_weight',
};

const row: Exercise = {
  id: 'barbell-row',
  name: 'Barbell Row',
  muscles: ['lats'],
  equipment: ['barbell'],
  category: 'free_weight',
};

describe('mergeCatalogById', () => {
  it('lets incoming rows replace matching ids', () => {
    const incoming = { ...bench, name: 'Bench Press' };
    expect(mergeCatalogById([bench, row], [incoming]).map((e) => e.name)).toEqual([
      'Bench Press',
      'Barbell Row',
    ]);
  });
});

describe('applyCatalogSeed', () => {
  it('applies seed names while keeping cached instructions', () => {
    const cached = { ...bench, name: 'Cable rear delt row', instructions: 'Keep me' };
    const seed = { ...bench, name: 'Cable Rear Delt Row' };

    expect(applyCatalogSeed([seed], [cached])).toEqual([
      { ...seed, instructions: 'Keep me' },
    ]);
  });

  it('keeps cache-only rows that the seed does not include', () => {
    expect(applyCatalogSeed([bench], [bench, row]).map((e) => e.id)).toEqual([
      'bench-press',
      'barbell-row',
    ]);
  });
});
