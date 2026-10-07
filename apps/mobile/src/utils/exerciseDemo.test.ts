import { describe, expect, it } from 'vitest';

import { CATALOG_SEED } from '@/data/catalogSeed';
import { EXERCISE_DEMO_IDS } from '@/data/exerciseDemos';
import { exerciseDemoUrl } from './exerciseDemo';

describe('exerciseDemoUrl', () => {
  it('links catalog exercises that have a demo to their website page', () => {
    expect(exerciseDemoUrl('squat')).toBe('https://muscleos.app/exercises/squat');
    expect(exerciseDemoUrl('bench-press')).toBe('https://muscleos.app/exercises/bench-press');
  });

  it('has no link for exercises without a demo, or custom exercises', () => {
    expect(exerciseDemoUrl('arnold-press')).toBeUndefined();
    expect(exerciseDemoUrl('custom_abc123')).toBeUndefined();
  });

  it('only lists published catalog ids', () => {
    const published = new Set(CATALOG_SEED.filter((e) => e.isPublished !== false).map((e) => e.id));
    for (const id of EXERCISE_DEMO_IDS) expect(published.has(id), id).toBe(true);
  });
});
