import { MUSCLE_GROUPS, type MuscleId } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  MUSCLE_AREAS,
  areaSelection,
  muscleArea,
  prefersSpecificMuscles,
  toggleArea,
  toggleMuscle,
} from './muscleAreas';

const shoulders = muscleArea('shoulders');

describe('MUSCLE_AREAS', () => {
  it('covers all 18 muscles exactly once', () => {
    const all = MUSCLE_AREAS.flatMap((a) => a.muscles);
    expect(all).toHaveLength(18);
    expect(new Set(all)).toEqual(new Set(Object.keys(MUSCLE_GROUPS)));
  });

  it('lists the areas head to toe, with Shoulders as all three delts', () => {
    expect(MUSCLE_AREAS.map((a) => a.label)).toEqual([
      'Chest',
      'Shoulders',
      'Back',
      'Arms',
      'Core',
      'Legs',
    ]);
    expect(shoulders.muscles).toEqual(['front_delts', 'side_delts', 'rear_delts']);
  });
});

describe('areaSelection', () => {
  it('is none, some or all', () => {
    expect(areaSelection([], shoulders)).toBe('none');
    expect(areaSelection(['chest', 'rear_delts'], shoulders)).toBe('some');
    expect(areaSelection(['rear_delts', 'front_delts', 'side_delts'], shoulders)).toBe('all');
  });
});

describe('toggleArea', () => {
  it('adds the whole area, keeping existing picks first', () => {
    expect(toggleArea(['chest'], shoulders)).toEqual([
      'chest',
      'front_delts',
      'side_delts',
      'rear_delts',
    ]);
  });

  it('fills in a partly selected area without duplicates', () => {
    expect(toggleArea(['side_delts'], shoulders)).toEqual([
      'side_delts',
      'front_delts',
      'rear_delts',
    ]);
  });

  it('clears a fully selected area and leaves other muscles', () => {
    const all: MuscleId[] = ['front_delts', 'chest', 'side_delts', 'rear_delts'];
    expect(toggleArea(all, shoulders)).toEqual(['chest']);
  });
});

describe('toggleMuscle', () => {
  it('appends or removes one muscle', () => {
    expect(toggleMuscle(['lats'], 'rhomboids')).toEqual(['lats', 'rhomboids']);
    expect(toggleMuscle(['lats', 'rhomboids'], 'lats')).toEqual(['rhomboids']);
  });
});

describe('prefersSpecificMuscles', () => {
  it('only when some area is partly selected', () => {
    expect(prefersSpecificMuscles([])).toBe(false);
    expect(prefersSpecificMuscles(['chest', 'abs', 'obliques'])).toBe(false);
    expect(prefersSpecificMuscles(['rear_delts'])).toBe(true);
  });
});
