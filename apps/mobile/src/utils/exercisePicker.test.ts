import type { Exercise, MuscleId } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  activePickerFilterCount,
  exerciseMuscleSplit,
  NO_PICKER_FILTERS,
  pickerFooter,
  pickerResults,
  type PickerFilters,
} from './exercisePicker';

const ex = (id: string, name: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  muscles: ['chest'],
  equipment: ['barbell'],
  category: 'free_weight',
  ...overrides,
});

const all = [
  ex('bench-press', 'Barbell Bench Press'),
  ex('incline-bench', 'Incline Bench Press'),
  ex('barbell-row', 'Barbell Row'),
];

const filters = (patch: Partial<PickerFilters>): PickerFilters => ({ ...NO_PICKER_FILTERS, ...patch });

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

  it('keeps exercises added during this visit, so they can be undone', () => {
    const keepIds = new Set(['incline-bench']);
    expect(pickerResults(all, '', ['bench-press', 'incline-bench'], { keepIds }).map((e) => e.id)).toEqual([
      'incline-bench',
      'barbell-row',
    ]);
  });

  describe('filters', () => {
    const lib = [
      ex('bench', 'Bench Press', { muscles: ['chest', 'triceps'] }),
      ex('pushdown', 'Triceps Pushdown', { muscles: ['triceps'], equipment: ['cable'], category: 'cable' }),
      ex('row', 'Dumbbell Row', { muscles: ['lats', 'biceps'], equipment: ['dumbbell'] }),
      ex('squat', 'Back Squat', { muscles: ['quads', 'glutes'] }),
    ];
    const ids = (f: Partial<PickerFilters>, covered?: MuscleId[], keep?: string[]) =>
      pickerResults(lib, '', [], {
        filters: filters(f),
        covered: covered ? new Set(covered) : undefined,
        keepIds: keep ? new Set(keep) : undefined,
      }).map((e) => e.id);

    it('a muscle area matches any of its muscles, not just the main one', () => {
      expect(ids({ area: 'arms' })).toEqual(['bench', 'pushdown', 'row']);
      expect(ids({ area: 'legs' })).toEqual(['squat']);
    });

    it('type and equipment narrow independently', () => {
      expect(ids({ category: 'cable' })).toEqual(['pushdown']);
      expect(ids({ equipment: 'dumbbell' })).toEqual(['row']);
      expect(ids({ equipment: 'barbell', area: 'legs' })).toEqual(['squat']);
    });

    it('New muscles only drops exercises whose main muscle is already trained', () => {
      expect(ids({ newMusclesOnly: true }, ['chest', 'triceps'])).toEqual(['row', 'squat']);
    });

    it('New muscles only keeps exercises added during this visit', () => {
      expect(ids({ newMusclesOnly: true }, ['chest', 'triceps', 'lats', 'biceps'], ['row'])).toEqual(['row', 'squat']);
    });

    it('New muscles only with nothing trained yet lists everything', () => {
      expect(ids({ newMusclesOnly: true }, [])).toEqual(['bench', 'pushdown', 'row', 'squat']);
    });

    it('filters AND with the search', () => {
      expect(
        pickerResults(lib, 'press', [], { filters: filters({ area: 'chest' }) }).map((e) => e.id)
      ).toEqual(['bench']);
    });
  });
});

describe('exerciseMuscleSplit', () => {
  it('treats the first-listed muscle as main', () => {
    expect(exerciseMuscleSplit(['lats', 'biceps', 'rear_delts'])).toEqual({
      main: 'lats',
      also: ['biceps', 'rear_delts'],
    });
    expect(exerciseMuscleSplit([])).toEqual({ main: null, also: [] });
  });
});

describe('activePickerFilterCount', () => {
  it('counts each set filter', () => {
    expect(activePickerFilterCount(NO_PICKER_FILTERS)).toBe(0);
    expect(activePickerFilterCount(filters({ area: 'legs', equipment: 'cable', newMusclesOnly: true }))).toBe(3);
  });
});

describe('pickerFooter', () => {
  it('shows neither a message nor Create for an empty, unfiltered search', () => {
    expect(pickerFooter('  ', 0)).toEqual({ emptyMessage: null, createName: null });
    expect(pickerFooter('', 3)).toEqual({ emptyMessage: null, createName: null });
  });

  it('offers Create "<query>" whenever the search has text, even with matches', () => {
    expect(pickerFooter(' Bench ', 2)).toEqual({ emptyMessage: null, createName: 'Bench' });
  });

  it('shows "No matching exercises" only when a search with text finds nothing', () => {
    expect(pickerFooter('zercher', 0)).toEqual({ emptyMessage: 'No matching exercises', createName: 'zercher' });
  });

  it('says the filters matched nothing when there is no search text', () => {
    expect(pickerFooter('', 0, true)).toEqual({ emptyMessage: 'No exercises match these filters', createName: null });
  });
});
