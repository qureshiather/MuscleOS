import type { Exercise } from '@muscleos/types';
import { MUSCLE_GROUPS } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  LARGE_MUSCLE_GROUPS,
  filterLibraryExercises,
  libraryFilterSummary,
  muscleFilterLabel,
} from './exerciseLibraryFilter';

const squat: Exercise = {
  id: 'squat',
  name: 'Back Squat',
  muscles: ['quads', 'glutes'],
  equipment: ['barbell'],
  category: 'free_weight',
};
const pulldown: Exercise = {
  id: 'lat-pulldown',
  name: 'Lat Pulldown',
  muscles: ['lats', 'biceps'],
  equipment: ['cable'],
  category: 'cable',
};
const pecDeck: Exercise = {
  id: 'pec-deck',
  name: 'Pec Deck',
  muscles: ['chest'],
  equipment: ['machine'],
  category: 'machine',
};
const raise: Exercise = {
  id: 'cable-lateral-raise',
  name: 'Cable Lateral Raise',
  muscles: ['side_delts'],
  equipment: ['cable'],
  category: 'cable',
};
const all = [squat, pulldown, pecDeck, raise];
const ids = (list: Exercise[]) => list.map((e) => e.id);

describe('LARGE_MUSCLE_GROUPS', () => {
  it('offers legs, back and shoulders, and no coarse chest group (avoids two Chest chips)', () => {
    expect(Object.keys(LARGE_MUSCLE_GROUPS)).toEqual(['legs', 'back', 'shoulders']);
    const labels = [
      ...Object.values(LARGE_MUSCLE_GROUPS).map((g) => g.label),
      ...Object.values(MUSCLE_GROUPS).map((m) => m.name),
    ];
    expect(labels.filter((l) => l === 'Chest')).toHaveLength(1);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('maps each group to its individual muscles', () => {
    expect(LARGE_MUSCLE_GROUPS.legs.muscles).toEqual([
      'quads',
      'hamstrings',
      'glutes',
      'adductors',
      'calves',
    ]);
    expect(LARGE_MUSCLE_GROUPS.back.muscles).toEqual(['lats', 'traps', 'lower_back', 'rhomboids']);
    expect(LARGE_MUSCLE_GROUPS.shoulders.muscles).toEqual(['front_delts', 'side_delts', 'rear_delts']);
  });
});

describe('filterLibraryExercises', () => {
  it('keeps the input order with no query and no filters', () => {
    expect(ids(filterLibraryExercises(all, { query: '', type: null, muscle: null }))).toEqual(
      ids(all)
    );
  });

  it('filters by Type', () => {
    expect(ids(filterLibraryExercises(all, { query: '', type: 'cable', muscle: null }))).toEqual([
      'lat-pulldown',
      'cable-lateral-raise',
    ]);
  });

  it('filters by a coarse muscle group (any overlap)', () => {
    expect(ids(filterLibraryExercises(all, { query: '', type: null, muscle: 'legs' }))).toEqual([
      'squat',
    ]);
    expect(ids(filterLibraryExercises(all, { query: '', type: null, muscle: 'shoulders' }))).toEqual([
      'cable-lateral-raise',
    ]);
  });

  it('filters by an individual muscle', () => {
    expect(ids(filterLibraryExercises(all, { query: '', type: null, muscle: 'chest' }))).toEqual([
      'pec-deck',
    ]);
    expect(ids(filterLibraryExercises(all, { query: '', type: null, muscle: 'biceps' }))).toEqual([
      'lat-pulldown',
    ]);
  });

  it('ANDs the query, Type and Muscle', () => {
    expect(ids(filterLibraryExercises(all, { query: 'cable', type: 'cable', muscle: null }))).toEqual(
      ['cable-lateral-raise', 'lat-pulldown']
    );
    expect(
      ids(filterLibraryExercises(all, { query: 'cable', type: 'cable', muscle: 'back' }))
    ).toEqual(['lat-pulldown']);
    expect(filterLibraryExercises(all, { query: 'squat', type: 'cable', muscle: null })).toEqual([]);
  });
});

describe('libraryFilterSummary', () => {
  it('summarises as "<Type> · <Muscle>"', () => {
    expect(libraryFilterSummary(null, null)).toBe('All · All');
    expect(libraryFilterSummary('free_weight', null)).toBe('Free Weight · All');
    expect(libraryFilterSummary('cable', 'back')).toBe('Cable · Back');
    expect(libraryFilterSummary(null, 'rear_delts')).toBe('All · Rear Delts');
    expect(libraryFilterSummary('bodyweight', 'chest')).toBe('Bodyweight · Chest');
  });

  it('labels muscles from the group or the muscle name', () => {
    expect(muscleFilterLabel('legs')).toBe('Legs');
    expect(muscleFilterLabel('lower_back')).toBe('Lower Back');
    expect(muscleFilterLabel(null)).toBe('All');
  });
});
