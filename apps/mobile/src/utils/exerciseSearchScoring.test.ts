import type { Exercise } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  exerciseSearchScore,
  expandQueryAbbreviations,
  normalizeSearchText,
  scoreSearchText,
  searchExercises,
  textMatchesQuery,
} from './exerciseSearch';

/** Score tiers, field weighting and ordering from docs/features/exercise-library.md#search. */
const score = (haystack: string, query: string) =>
  scoreSearchText(haystack, normalizeSearchText(query));

function ex(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name,
    muscles: ['biceps'],
    equipment: ['dumbbell'],
    category: 'free_weight',
    ...extra,
  };
}

describe('score tiers', () => {
  it('1000 for an exact match, normalized or with spaces removed', () => {
    expect(score('Bench Press', 'bench press')).toBe(1000);
    expect(score('Bench Press', 'benchpress')).toBe(1000);
    expect(score('Push-Up', 'push up')).toBe(1000);
  });

  it('960 for an exact match ignoring a trailing plural s', () => {
    expect(score('Lunges', 'lunge')).toBe(960);
    expect(score('Lunge', 'lunges')).toBe(960);
  });

  it('800 for a prefix', () => {
    expect(score('Bench Press', 'bench')).toBe(800);
  });

  it('700 for a substring', () => {
    expect(score('Barbell Bench Press', 'bench')).toBe(700);
  });

  it('640 for a stem substring of at least 4 chars', () => {
    expect(score('Hammer Curl', 'curls')).toBe(640);
  });

  it('520 when all tokens are present in order (after stemming)', () => {
    expect(score('Hip Abduction Machine', 'hip abductor machine')).toBe(520);
  });

  it('400 when all tokens are present in any order', () => {
    expect(score('Barbell Bench Press', 'press bench')).toBe(400);
  });

  it('280 for a whole-string fuzzy match on a 5+ char query', () => {
    expect(score('Pushup', 'psh up')).toBe(280);
  });

  it('260 for a whole-string fuzzy match on the de-pluralized query', () => {
    expect(score('Pushup', 'psh ups')).toBe(260);
  });

  it('no whole-string fuzzy match below 5 chars', () => {
    expect(score('Shrug', 'sh rg')).toBe(0); // 4 compact chars, one edit away
    expect(score('Shrugs', 'sh rgs')).toBe(280); // 5 compact chars, one edit away
  });

  it('0 for no match', () => {
    expect(score('Barbell Row', 'squat')).toBe(0);
  });
});

describe('fuzzy tolerance by length', () => {
  it('allows no edits for queries of 3 chars or fewer', () => {
    expect(textMatchesQuery('Row', 'rwo')).toBe(false);
    expect(textMatchesQuery('Row', 'row')).toBe(true);
  });

  it('allows one edit for 4–6 chars', () => {
    expect(textMatchesQuery('Barbell Bench Press', 'bnch')).toBe(true);
    expect(textMatchesQuery('Overhead Press', 'prxss')).toBe(true);
    expect(textMatchesQuery('Deadlift', 'dedlft')).toBe(false);
  });

  it('allows two edits for 7+ chars', () => {
    expect(textMatchesQuery('Deadlift', 'deadlfit')).toBe(true);
    expect(textMatchesQuery('Deadlift', 'dedlfitt')).toBe(false);
  });
});

describe('field weighting', () => {
  it('adds +80 to a name match', () => {
    expect(exerciseSearchScore(ex('x1', 'Bench Press'), 'bench press')).toBe(1080);
  });

  it('adds +40 to an id match', () => {
    expect(exerciseSearchScore(ex('bench-press', 'Flat Press'), 'bench press')).toBe(1040);
  });

  it('adds +20 to an alias match', () => {
    expect(
      exerciseSearchScore(ex('x1', 'Flat Press', { aliases: ['bench-press'] }), 'bench press')
    ).toBe(1020);
  });

  it('takes the best field when several match', () => {
    expect(exerciseSearchScore(ex('bench-press', 'Bench Press'), 'bench press')).toBe(1080);
  });

  it('caps metadata-only matches (category, equipment, muscles) at 350', () => {
    const fly = ex('fly', 'Pec Fly', {
      muscles: ['chest'],
      equipment: ['machine'],
      category: 'machine',
    });
    expect(exerciseSearchScore(fly, 'chest')).toBe(350);
    expect(exerciseSearchScore(fly, 'machine')).toBe(350);
    expect(exerciseSearchScore(ex('curl', 'Curl', { muscles: ['rear_delts'] }), 'rear delts')).toBe(
      350
    );
    expect(exerciseSearchScore(ex('curl', 'Curl'), 'free weight')).toBe(350);
  });

  it('ranks a metadata-only hit below name matches from the any-order tier up', () => {
    const meta = ex('b', 'Zottman', { muscles: ['glutes'] });
    expect(searchExercises([meta, ex('c', 'Glute Bridge')], 'glute').map((e) => e.id)).toEqual([
      'c',
      'b',
    ]);
    expect(exerciseSearchScore(ex('d', 'Barbell Bench Press'), 'press bench')).toBe(480);
  });

  it('a whole-string fuzzy name hit scores 360/340, straddling the metadata cap', () => {
    expect(exerciseSearchScore(ex('p', 'Pushup'), 'psh up')).toBe(360);
    expect(exerciseSearchScore(ex('p', 'Pushup'), 'psh ups')).toBe(340);
  });
});

describe('cross-field matches', () => {
  it('scores 420 when tokens split across the name and muscles ("bicep curl" → Barbell Curl)', () => {
    const barbellCurl = ex('barbell-curl', 'Barbell Curl', { equipment: ['barbell'] });
    expect(exerciseSearchScore(barbellCurl, 'bicep curl')).toBe(420);
    expect(exerciseSearchScore(barbellCurl, 'biceps curl')).toBe(420);
  });

  it('matches equipment as a token too ("barbell squat" → Front Squat)', () => {
    const front = ex('front-squat', 'Front Squat', { muscles: ['quads'], equipment: ['barbell'] });
    expect(exerciseSearchScore(front, 'barbell squat')).toBe(420);
  });

  it('needs at least one token in the name', () => {
    expect(exerciseSearchScore(ex('a', 'Hammer Curl'), 'biceps dumbbell')).toBe(0);
  });

  it('needs every token to match somewhere', () => {
    expect(exerciseSearchScore(ex('a', 'Barbell Curl'), 'bicep curl machine')).toBe(0);
  });

  it('ranks below a name match and above a metadata-only hit', () => {
    const list = [
      ex('barbell-curl', 'Barbell Curl'),
      ex('machine-bicep-curl', 'Machine Bicep Curl'),
    ];
    expect(searchExercises(list, 'bicep curl').map((e) => e.id)).toEqual([
      'machine-bicep-curl',
      'barbell-curl',
    ]);
    const metadataOnly = ex('hammer', 'Hammer Curl');
    expect(exerciseSearchScore(metadataOnly, 'biceps')).toBeLessThan(420);
  });
});

describe('abbreviations', () => {
  it.each([
    ['db curl', 'Dumbbell Curl'],
    ['bb row', 'Barbell Row'],
    ['kb swing', 'Kettlebell Swing'],
    ['ohp', 'Overhead Press'],
    ['rdl', 'Romanian Deadlift'],
  ])('"%s" finds %s', (query, name) => {
    const target = ex('target', name);
    expect(searchExercises([ex('other', 'Leg Press', { muscles: ['quads'] }), target], query)).toEqual([
      target,
    ]);
  });

  it('expands whole words only', () => {
    expect(expandQueryAbbreviations('dbx curl')).toBe('dbx curl');
    expect(expandQueryAbbreviations('db curl')).toBe('dumbbell curl');
  });
});

describe('searchExercises ordering', () => {
  it('sorts by descending score', () => {
    const list = [ex('a', 'Barbell Bench Press'), ex('b', 'Bench Press'), ex('c', 'Bench')];
    expect(searchExercises(list, 'bench').map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('breaks score ties by name', () => {
    const list = [ex('z', 'Zercher Curl'), ex('h', 'Hammer Curl'), ex('c', 'Cable Curl')];
    expect(searchExercises(list, 'curl').map((e) => e.name)).toEqual([
      'Cable Curl',
      'Hammer Curl',
      'Zercher Curl',
    ]);
  });

  it('returns the input unchanged for an empty or punctuation-only query', () => {
    const list = [ex('z', 'Zercher Curl'), ex('a', 'Arnold Press')];
    expect(searchExercises(list, '')).toBe(list);
    expect(searchExercises(list, '   ')).toBe(list);
    expect(searchExercises(list, '--')).toBe(list);
  });

  it('drops non-matches', () => {
    expect(searchExercises([ex('a', 'Arnold Press')], 'squat')).toEqual([]);
  });
});
