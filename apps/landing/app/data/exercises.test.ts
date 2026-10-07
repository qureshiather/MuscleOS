import { describe, expect, it } from 'vitest';

import demoIds from './exerciseDemos.json';
import {
  DEMO_EXERCISES,
  FEATURED_DEMOS,
  demoSources,
  EXERCISES,
  exercisePath,
  filterExercises,
  getExercise,
  hasDemo,
  muscleLine,
  relatedExercises,
  typeLine,
} from './exercises';

describe('exercise catalog for the website', () => {
  it('lists published catalog exercises A–Z with unique ids', () => {
    expect(EXERCISES.length).toBeGreaterThan(300);
    const names = EXERCISES.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it('every demo belongs to a published catalog exercise', () => {
    for (const id of demoIds) expect(getExercise(id), id).toBeDefined();
    expect(DEMO_EXERCISES).toHaveLength(demoIds.length);
  });

  it('serves a clip and poster per theme only for exercises with a demo', () => {
    expect(hasDemo('squat')).toBe(true);
    expect(demoSources('squat')).toEqual({
      dark: { video: '/exercise-demos/squat-dark.mp4', poster: '/exercise-demos/squat-dark.webp' },
      light: { video: '/exercise-demos/squat-light.mp4', poster: '/exercise-demos/squat-light.webp' },
    });
    expect(hasDemo('not-an-exercise')).toBe(false);
    expect(demoSources('not-an-exercise')).toBeUndefined();
  });

  it('links each exercise at /exercises/<id>', () => {
    expect(exercisePath('bench-press')).toBe('/exercises/bench-press');
  });

  it('labels muscles with display names, never raw ids', () => {
    const row = getExercise('squat');
    expect(row && muscleLine(row)).toBe('Quads, Glutes, Lower Back, Calves');
  });

  it('search matches every word against name, muscles and equipment', () => {
    const ids = (q: string) => filterExercises(EXERCISES, q).map((e) => e.id);
    expect(ids('')).toHaveLength(EXERCISES.length);
    expect(ids('bench')).toContain('bench-press');
    expect(ids('LOWER back barbell')).toContain('squat');
    expect(ids('rear delts')).toContain('face-pull');
    expect(ids('zzzz')).toEqual([]);
  });
});

describe('related exercises', () => {
  it('share the main muscle, put demos first and exclude the exercise itself', () => {
    const related = relatedExercises('bench-press', 6);
    expect(related).toHaveLength(6);
    expect(related.every((e) => e.muscles.includes('chest'))).toBe(true);
    expect(related.map((e) => e.id)).not.toContain('bench-press');
    const firstPlain = related.findIndex((e) => !hasDemo(e.id));
    if (firstPlain >= 0) expect(related.slice(firstPlain).every((e) => !hasDemo(e.id))).toBe(true);
  });

  it('is empty for an unknown id', () => {
    expect(relatedExercises('not-an-exercise')).toEqual([]);
  });
});

describe('type line', () => {
  it('pairs the library type with the equipment, without repeating it', () => {
    const label = (id: string) => {
      const row = getExercise(id);
      return row ? typeLine(row) : undefined;
    };
    expect(label('squat')).toBe('Free Weight · Barbell');
    expect(label('plank')).toBe('Bodyweight');
    expect(label('leg-press')).toBe('Machine');
    expect(label('face-pull')).toBe('Cable · Band');
  });
});

describe('featured demos', () => {
  it('are staple lifts that all have a demo', () => {
    expect(FEATURED_DEMOS.length).toBeGreaterThanOrEqual(12);
    for (const e of FEATURED_DEMOS) expect(hasDemo(e.id)).toBe(true);
  });
});
