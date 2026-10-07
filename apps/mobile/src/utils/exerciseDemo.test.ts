import { describe, expect, it } from 'vitest';

import { exercisePageUrl } from './exerciseDemo';

describe('exercisePageUrl', () => {
  it('links every published catalog exercise to its website page', () => {
    expect(exercisePageUrl({ id: 'squat', isPublished: true })).toBe('https://muscleos.app/exercises/squat');
    expect(exercisePageUrl({ id: 'arnold-press' })).toBe('https://muscleos.app/exercises/arnold-press');
  });

  it('has no page for custom exercises or unpublished catalog rows', () => {
    expect(exercisePageUrl({ id: 'custom_abc123' })).toBeUndefined();
    expect(exercisePageUrl({ id: 'rowing-machine', isPublished: false })).toBeUndefined();
  });
});
