import { MUSCLE_GROUPS } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { BODY_FIGURES } from '@/data/bodyFigures';
import {
  focusRegions,
  MUSCLE_ID_TO_DIAGRAM_REGION,
  musclesOnView,
  regionStatesByView,
  regionStatesForMuscles,
  regionStatesToBodyData,
} from './muscleDiagramRegions';

describe('MUSCLE_ID_TO_DIAGRAM_REGION', () => {
  it('maps all 20 muscle ids onto 18 regions', () => {
    const ids = Object.keys(MUSCLE_GROUPS);
    expect(Object.keys(MUSCLE_ID_TO_DIAGRAM_REGION).sort()).toEqual([...ids].sort());
    expect(new Set(Object.values(MUSCLE_ID_TO_DIAGRAM_REGION)).size).toBe(18);
  });

  it('shades all delts together', () => {
    const r = MUSCLE_ID_TO_DIAGRAM_REGION;
    expect([r.front_delts, r.side_delts, r.rear_delts]).toEqual(['deltoids', 'deltoids', 'deltoids']);
  });

  it('gives lats and rhomboids their own regions', () => {
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.lats).toBe('lats');
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.rhomboids).toBe('upper-back');
  });

  it('only uses regions the figures draw, with lats and upper back on both back views', () => {
    const figures = [BODY_FIGURES.male, BODY_FIGURES.female].flatMap((g) => [g.front, g.back]);
    const drawn = new Set(figures.flatMap((f) => f.parts.map((p) => p.id)));
    for (const region of Object.values(MUSCLE_ID_TO_DIAGRAM_REGION)) expect(drawn).toContain(region);
    for (const back of [BODY_FIGURES.male.back, BODY_FIGURES.female.back]) {
      const ids = back.parts.map((p) => p.id);
      expect(ids.filter((id) => id === 'lats')).toHaveLength(1);
      expect(ids.filter((id) => id === 'upper-back')).toHaveLength(1);
    }
  });

  it('keeps adductors as their own region and abductors on the glutes', () => {
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.adductors).toBe('adductors');
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.glutes).toBe('gluteal');
  });

  it('gives the shin and neck their own regions instead of calves and traps', () => {
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.tibialis).toBe('tibialis');
    expect(MUSCLE_ID_TO_DIAGRAM_REGION.neck).toBe('neck');
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
    expect(regionStatesForMuscles(['lats', 'rhomboids'], new Set(['lats']), new Set())).toEqual({
      lats: 'recovering',
      'upper-back': 'ready',
    });
  });
});

describe('musclesOnView', () => {
  it('keeps front delts to the front figure and rear delts to the back; side delts show on both', () => {
    const delts = ['front_delts', 'side_delts', 'rear_delts'] as const;
    expect(musclesOnView(delts, 'front')).toEqual(['front_delts', 'side_delts']);
    expect(musclesOnView(delts, 'back')).toEqual(['side_delts', 'rear_delts']);
    expect(musclesOnView(['chest', 'lats'], 'front')).toEqual(['chest', 'lats']);
  });
});

describe('regionStatesByView', () => {
  it('colours each view\'s deltoids from its own delt heads', () => {
    const states = regionStatesByView(['front_delts', 'rear_delts', 'lats'], new Set(['rear_delts']), new Set());
    expect(states.front).toEqual({ deltoids: 'ready', lats: 'ready' });
    expect(states.back).toEqual({ deltoids: 'recovering', lats: 'ready' });
  });

  it('leaves deltoids unlit on the front for a rear-delt-only workout', () => {
    expect(regionStatesByView(['rear_delts'], new Set(), new Set()).front).toEqual({});
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
    expect(focusRegions([['lats'], ['biceps']]).sort()).toEqual(['biceps', 'lats']);
    expect(focusRegions([])).toEqual([]);
  });
});

describe('regionStatesToBodyData', () => {
  const states = { chest: 'justTrained', deltoids: 'recovering', quadriceps: 'ready' } as const;

  it('maps three states to palette indexes hot 1, warm 2, ready 3', () => {
    expect(regionStatesToBodyData(states)).toEqual([
      { slug: 'chest', intensity: 1 },
      { slug: 'deltoids', intensity: 2 },
      { slug: 'quadriceps', intensity: 3 },
    ]);
  });

  it('leaves regions without a state out, so they keep the neutral fill', () => {
    const data = regionStatesToBodyData(regionStatesForMuscles(['chest'], new Set(['chest']), new Set(['chest'])));
    expect(data).toEqual([{ slug: 'chest', intensity: 1 }]);
  });

  it('covers all 18 regions when built from every muscle (Recovery tab)', () => {
    const all = Object.keys(MUSCLE_GROUPS) as (keyof typeof MUSCLE_GROUPS)[];
    const data = regionStatesToBodyData(regionStatesForMuscles(all, new Set(['lats']), new Set(['lats'])));
    expect(data).toHaveLength(18);
    expect(data.find((d) => d.slug === 'lats')?.intensity).toBe(1);
    expect(data.filter((d) => d.intensity === 3)).toHaveLength(17);
  });
});
