import { describe, expect, it } from 'vitest';
import { catalogRowToExercise, normalizeExercise } from './exerciseNormalize';

describe('normalizeExercise', () => {
  it('infers category from equipment and defaults missing fields', () => {
    const exercise = normalizeExercise({
      id: 'lat-pulldown',
      name: '  Lat Pulldown  ',
      equipment: ['cable', 'not-real'],
      tracking_type: 'bodyweight_reps',
    });

    expect(exercise).toMatchObject({
      id: 'lat-pulldown',
      name: 'Lat Pulldown',
      category: 'cable',
      equipment: ['cable'],
      muscles: ['chest'],
      trackingType: 'bodyweight_reps',
      isPublished: true,
    });
  });

  it('maps catalog snake_case rows into the app exercise shape', () => {
    const exercise = catalogRowToExercise({
      id: 'plank',
      name: 'Plank',
      muscles: ['abs'],
      equipment: ['bodyweight'],
      category: 'bodyweight',
      tracking_type: 'duration',
      is_published: false,
    });

    expect(exercise.trackingType).toBe('duration');
    expect(exercise.isPublished).toBe(false);
    expect(exercise.muscles).toEqual(['abs']);
  });
});
