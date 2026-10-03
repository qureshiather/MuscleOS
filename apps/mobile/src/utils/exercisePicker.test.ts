import type { Exercise } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { pickerFooter, pickerResults } from './exercisePicker';

const ex = (id: string, name: string): Exercise => ({
  id,
  name,
  muscles: ['chest'],
  equipment: ['barbell'],
  category: 'free_weight',
});

const all = [
  ex('bench-press', 'Barbell Bench Press'),
  ex('incline-bench', 'Incline Bench Press'),
  ex('barbell-row', 'Barbell Row'),
];

describe('pickerResults', () => {
  it('lists everything in catalog order for an empty query', () => {
    expect(pickerResults(all, '', []).map((e) => e.id)).toEqual([
      'bench-press',
      'incline-bench',
      'barbell-row',
    ]);
  });

  it('excludes exercises already in the workout', () => {
    expect(pickerResults(all, '', ['bench-press', 'barbell-row']).map((e) => e.id)).toEqual([
      'incline-bench',
    ]);
  });

  it('searches with the shared exercise search, still excluding', () => {
    expect(pickerResults(all, 'bench', []).map((e) => e.id).sort()).toEqual([
      'bench-press',
      'incline-bench',
    ]);
    expect(pickerResults(all, 'bench', ['bench-press']).map((e) => e.id)).toEqual(['incline-bench']);
  });

  it('returns nothing when the only match is already in the workout', () => {
    expect(pickerResults(all, 'row', ['barbell-row'])).toEqual([]);
  });
});

describe('pickerFooter', () => {
  it('shows neither "No matching" nor Create for an empty search', () => {
    expect(pickerFooter('  ', 0)).toEqual({ showNoMatches: false, createName: null });
    expect(pickerFooter('', 3)).toEqual({ showNoMatches: false, createName: null });
  });

  it('offers Create "<query>" whenever the search has text, even with matches', () => {
    expect(pickerFooter(' Bench ', 2)).toEqual({ showNoMatches: false, createName: 'Bench' });
  });

  it('shows "No matching exercises" only when a search with text finds nothing', () => {
    expect(pickerFooter('zercher', 0)).toEqual({ showNoMatches: true, createName: 'zercher' });
  });
});
