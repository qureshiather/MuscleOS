import { MUSCLE_GROUPS } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { MUSCLE_ID_TO_DIAGRAM_REGION, regionStatesForMuscles } from './muscleDiagramRegions';

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
