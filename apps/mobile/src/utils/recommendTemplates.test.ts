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
