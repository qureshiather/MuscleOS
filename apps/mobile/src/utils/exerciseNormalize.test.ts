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

  it('falls back to the id when the name is missing or blank', () => {
    expect(normalizeExercise({ id: 'custom_4' }).name).toBe('custom_4');
    expect(normalizeExercise({ id: 'custom_4', name: '   ' }).name).toBe('custom_4');
    expect(normalizeExercise({}, 'catalog_7')).toMatchObject({ id: 'catalog_7', name: 'catalog_7' });
  });

  it('defaults tracking type to weight_reps (customs never set it)', () => {
    expect(normalizeExercise({ id: 'custom_1', name: 'X' }).trackingType).toBe('weight_reps');
    expect(normalizeExercise({ id: 'custom_1', trackingType: 'nonsense' }).trackingType).toBe(
      'weight_reps'
    );
  });

  it('drops unknown muscle ids, keeping valid ones', () => {
    expect(
      normalizeExercise({ id: 'x', muscles: ['lats', 'wings', 'constructor', 'biceps'] }).muscles
    ).toEqual(['lats', 'biceps']);
  });

  it("falls back to ['chest'] only when no valid muscle is left", () => {
    expect(normalizeExercise({ id: 'x', muscles: ['wings'] }).muscles).toEqual(['chest']);
    expect(normalizeExercise({ id: 'x', muscles: [] }).muscles).toEqual(['chest']);
    expect(normalizeExercise({ id: 'x' }).muscles).toEqual(['chest']);
  });

  it('infers category in priority cable → machine → bodyweight → free_weight', () => {
    const cat = (equipment: string[]) => normalizeExercise({ id: 'x', equipment }).category;
    expect(cat(['bodyweight', 'machine', 'cable'])).toBe('cable');
    expect(cat(['bodyweight', 'machine'])).toBe('machine');
    expect(cat(['dumbbell', 'bodyweight'])).toBe('bodyweight');
    expect(cat(['band'])).toBe('free_weight');
    expect(cat([])).toBe('free_weight');
  });

  it('keeps an explicit valid category over the inferred one', () => {
    expect(normalizeExercise({ id: 'x', equipment: ['cable'], category: 'machine' }).category).toBe(
      'machine'
    );
    expect(normalizeExercise({ id: 'x', equipment: ['cable'], category: 'bogus' }).category).toBe(
      'cable'
    );
  });

  it('omits instructions that are missing or blank, and trims present ones', () => {
    expect('instructions' in normalizeExercise({ id: 'x', instructions: undefined })).toBe(false);
    expect('instructions' in normalizeExercise({ id: 'x', instructions: '  ' })).toBe(false);
    expect(normalizeExercise({ id: 'x', instructions: ' Brace. ' }).instructions).toBe('Brace.');
  });

  it('tolerates non-object input', () => {
    expect(normalizeExercise(null, 'fallback')).toMatchObject({ id: 'fallback', muscles: ['chest'] });
  });
});
