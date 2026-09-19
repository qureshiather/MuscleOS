import type { Exercise } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  normalizeSearchText,
  searchExercises,
  textMatchesQuery,
} from './exerciseSearch';

const bench: Exercise = {
  id: 'bench-press',
  name: 'Barbell Bench Press',
  muscles: ['chest', 'triceps'],
  equipment: ['barbell'],
  category: 'free_weight',
  aliases: ['bench'],
};

const row: Exercise = {
  id: 'barbell-row',
  name: 'Barbell Row',
  muscles: ['lats', 'rhomboids'],
  equipment: ['barbell'],
  category: 'free_weight',
};

describe('exercise search', () => {
  it('normalizes diacritics and punctuation', () => {
    expect(normalizeSearchText('Développé-couché')).toBe('developpe couche');
  });

  it('ranks an exact/alias hit above a weaker name match', () => {
    const results = searchExercises([row, bench], 'bench');
    expect(results.map((e) => e.id)).toEqual(['bench-press']);
  });

  it('matches common typos without returning unrelated lifts', () => {
    expect(textMatchesQuery('Barbell Bench Press', 'bnch')).toBe(true);
    expect(searchExercises([bench, row], 'squat')).toEqual([]);
  });
});

const hipAbduction: Exercise = {
  id: 'hip-abductor',
  name: 'Hip Abduction Machine',
  muscles: ['glutes'],
  equipment: ['machine'],
  category: 'machine',
};

const hipAdduction: Exercise = {
  id: 'hip-adductor',
  name: 'Hip Adduction Machine',
  muscles: ['adductors'],
  equipment: ['machine'],
  category: 'machine',
};

describe('hip abductor/adductor search', () => {
  it('finds the machines from abductor/adductor wording', () => {
    const catalog = [hipAbduction, hipAdduction, bench];
    expect(searchExercises(catalog, 'hip abduction machine')[0]?.id).toBe('hip-abductor');
    expect(searchExercises(catalog, 'hip adductors machine')[0]?.id).toBe('hip-adductor');
    expect(searchExercises(catalog, 'hip abductor machine')[0]?.id).toBe('hip-abductor');
  });
});
