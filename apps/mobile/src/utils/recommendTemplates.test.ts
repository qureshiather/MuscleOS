import type { MuscleId, WorkoutTemplate } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { recommendTemplates } from './recommendTemplates';

const push: WorkoutTemplate = {
  id: 'push',
  name: 'Push',
  exerciseIds: ['bench'],
};
const pull: WorkoutTemplate = {
  id: 'pull',
  name: 'Pull',
  exerciseIds: ['row'],
};
const legs: WorkoutTemplate = {
  id: 'legs',
  name: 'Legs',
  exerciseIds: ['squat'],
};

const muscles: Record<string, MuscleId[]> = {
  push: ['chest', 'front_delts', 'triceps'],
  pull: ['lats', 'biceps', 'rhomboids'],
  legs: ['quads', 'hamstrings', 'glutes'],
};

const nowMs = Date.parse('2026-09-12T16:00:00.000Z');

describe('recommendTemplates', () => {
  it('skips templates that are still mostly recovering', () => {
    const recs = recommendTemplates({
      templates: [push, pull],
      recoveringMuscleIds: new Set(['chest', 'front_delts', 'triceps', 'lats']),
      getTemplateMuscles: (t) => muscles[t.id] ?? [],
      lastDoneByTemplate: {},
      nowMs,
    });
    expect(recs.map((r) => r.template.id)).toEqual(['pull']);
  });

  it('diversifies suggestions so they do not all hit the same muscles', () => {
    const recs = recommendTemplates({
      templates: [push, pull, legs],
      recoveringMuscleIds: new Set(),
      recentlyWorkedMuscleIds: new Set(['chest', 'front_delts', 'triceps']),
      getTemplateMuscles: (t) => muscles[t.id] ?? [],
      lastDoneByTemplate: { push: '2026-09-12T12:00:00.000Z' },
      nowMs,
    });
    expect(recs[0]?.template.id).not.toBe('push');
    expect(new Set(recs.map((r) => r.template.id))).toEqual(
      new Set(['pull', 'legs', 'push'])
    );
  });
});

describe('recommendTemplates scoring', () => {
  const base = {
    recoveringMuscleIds: new Set<MuscleId>(),
    getTemplateMuscles: (t: WorkoutTemplate) => muscles[t.id] ?? [],
    nowMs,
  };
  const daysAgo = (d: number) => new Date(nowMs - d * 24 * 60 * 60 * 1000).toISOString();

  it('scores ready × 100 + variety × 28, with a +3 novelty bump when never done and ≥75% ready', () => {
    const [rec] = recommendTemplates({ ...base, templates: [push], lastDoneByTemplate: {} });
    expect(rec?.score).toBe(100 + 28 + 3);
  });

  it('keeps a template at exactly 50% ready and skips one below', () => {
    const t: WorkoutTemplate = { id: 'half', name: 'Half', exerciseIds: [] };
    const run = (recovering: MuscleId[]) =>
      recommendTemplates({
        ...base,
        templates: [t],
        recoveringMuscleIds: new Set(recovering),
        getTemplateMuscles: () => ['chest', 'lats', 'quads', 'biceps'],
        lastDoneByTemplate: {},
      });
    expect(run(['chest', 'lats'])[0]?.readyFraction).toBe(0.5);
    expect(run(['chest', 'lats', 'quads'])).toEqual([]);
  });

  it('adds +5 within 30 days and a further −20 within 2 days', () => {
    const score = (d: number) =>
      recommendTemplates({ ...base, templates: [push], lastDoneByTemplate: { push: daysAgo(d) } })[0]
        ?.score;
    expect(score(10)).toBe(128 + 5);
    expect(score(1)).toBe(128 + 5 - 20);
    expect(score(40)).toBe(128);
  });

  it('skips templates whose muscles do not resolve', () => {
    const empty: WorkoutTemplate = { id: 'none', name: 'None', exerciseIds: [] };
    expect(recommendTemplates({ ...base, templates: [empty], lastDoneByTemplate: {} })).toEqual([]);
  });

  it('breaks score ties by name and respects the limit', () => {
    const recs = recommendTemplates({
      ...base,
      templates: [push, pull, legs],
      lastDoneByTemplate: {},
      limit: 2,
    });
    expect(recs.map((r) => r.template.name)).toEqual(['Legs', 'Pull']);
  });

  it('subtracts 8 per muscle overlapping an earlier pick', () => {
    const pushAlt: WorkoutTemplate = { id: 'push2', name: 'Push B', exerciseIds: [] };
    const recs = recommendTemplates({
      ...base,
      templates: [push, pushAlt, legs],
      getTemplateMuscles: (t) => (t.id === 'push2' ? muscles.push : (muscles[t.id] ?? [])),
      lastDoneByTemplate: { push: daysAgo(10), push2: daysAgo(10) },
    });
    // Push / Push B outscore Legs (+5), but after picking Push, Push B loses 3 × 8 and drops below Legs.
    expect(recs.map((r) => r.template.id)).toEqual(['push', 'legs', 'push2']);
  });
});
