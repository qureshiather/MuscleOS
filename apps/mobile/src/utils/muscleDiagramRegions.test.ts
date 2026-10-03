import { MUSCLE_GROUPS } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  focusRegions,
  MUSCLE_ID_TO_DIAGRAM_REGION,
  regionStatesForMuscles,
  regionStatesToBodyData,
} from './muscleDiagramRegions';

describe('MUSCLE_ID_TO_DIAGRAM_REGION', () => {
  it('maps all 18 muscle ids onto 15 regions', () => {
    const ids = Object.keys(MUSCLE_GROUPS);
    expect(Object.keys(MUSCLE_ID_TO_DIAGRAM_REGION).sort()).toEqual([...ids].sort());
    expect(new Set(Object.values(MUSCLE_ID_TO_DIAGRAM_REGION)).size).toBe(15);
  });

  it('shades all delts together, and lats with rhomboids', () => {
    const r = MUSCLE_ID_TO_DIAGRAM_REGION;
    expect([r.front_delts, r.side_delts, r.rear_delts]).toEqual(['deltoids', 'deltoids', 'deltoids']);
    expect([r.lats, r.rhomboids]).toEqual(['upper-back', 'upper-back']);
  });

  it('keeps adductors as their own region and abductors on the glutes', () => {
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.adductors).toBe('adductors');
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.glutes).toBe('gluteal');
  });
});

describe('regionStatesForMuscles', () => {
  it('marks each region ready, recovering, or just trained', () => {
    const states = regionStatesForMuscles(
      ['chest', 'triceps', 'quads'],
      new Set(['chest', 'triceps']),
      new Set(['triceps'])
    );
    expect(states).toEqual({ chest: 'recovering', triceps: 'justTrained', quadriceps: 'ready' });
  });

  it('gives a shared region the least-recovered state of its muscles', () => {
    expect(regionStatesForMuscles(['front_delts', 'rear_delts'], new Set(['rear_delts']), new Set())).toEqual({
      deltoids: 'recovering',
    });
    expect(regionStatesForMuscles(['lats', 'rhomboids'], new Set(), new Set())).toEqual({ 'upper-back': 'ready' });
  });
});

describe('focusRegions', () => {
  it('drops regions only one accessory exercise trains', () => {
    const focus = focusRegions([
      ['quads', 'glutes'],
      ['hamstrings', 'glutes', 'lower_back'],
      ['quads', 'glutes'],
      ['hamstrings'],
      ['calves'],
      ['abs'],
    ]);
    expect(focus.sort()).toEqual(['gluteal', 'hamstring', 'quadriceps']);
  });

  it('keeps a main muscle even when another region is hit far more often', () => {
    // Built-in Push: triceps in 5 exercises, chest in 2.
    const focus = focusRegions([
      ['chest', 'front_delts', 'triceps'],
      ['front_delts', 'side_delts', 'triceps'],
      ['chest', 'front_delts', 'triceps'],
      ['side_delts'],
      ['triceps'],
      ['triceps'],
    ]);
    expect(focus.sort()).toEqual(['chest', 'deltoids', 'triceps']);
  });

  it('counts a shared region once per exercise', () => {
    expect(focusRegions([['front_delts', 'side_delts', 'rear_delts'], ['chest']]).sort()).toEqual(['chest', 'deltoids']);
  });

  it('keeps every region when none repeats, and is empty with no muscles', () => {
    expect(focusRegions([['lats'], ['biceps']]).sort()).toEqual(['biceps', 'upper-back']);
    expect(focusRegions([])).toEqual([]);
  });
});

describe('regionStatesToBodyData', () => {
  const states = { chest: 'justTrained', deltoids: 'recovering', quadriceps: 'ready' } as const;

  it('maps three states to palette indexes hot 1, warm 2, ready 3', () => {
    expect(regionStatesToBodyData(states, true)).toEqual([
      { slug: 'chest', intensity: 1 },
      { slug: 'deltoids', intensity: 2 },
      { slug: 'quadriceps', intensity: 3 },
    ]);
  });

  it('maps two states to warm 1 (recovering or just trained) and ready 2', () => {
    expect(regionStatesToBodyData(states, false)).toEqual([
      { slug: 'chest', intensity: 1 },
      { slug: 'deltoids', intensity: 1 },
      { slug: 'quadriceps', intensity: 2 },
    ]);
  });

  it('leaves regions without a state out, so they keep the neutral fill', () => {
    const data = regionStatesToBodyData(regionStatesForMuscles(['chest'], new Set(['chest']), new Set(['chest'])), true);
    expect(data).toEqual([{ slug: 'chest', intensity: 1 }]);
  });

  it('covers all 15 regions when built from every muscle (Recovery tab)', () => {
    const all = Object.keys(MUSCLE_GROUPS) as (keyof typeof MUSCLE_GROUPS)[];
    const data = regionStatesToBodyData(regionStatesForMuscles(all, new Set(['lats']), new Set()), false);
    expect(data).toHaveLength(15);
    expect(data.find((d) => d.slug === 'upper-back')?.intensity).toBe(1);
    expect(data.filter((d) => d.intensity === 2)).toHaveLength(14);
  });
});
