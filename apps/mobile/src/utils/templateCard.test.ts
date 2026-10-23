import { describe, expect, it } from 'vitest';
import type { Exercise } from '@muscleos/types';
import { templateCardModel } from './templateCard';

const exercises: Record<string, Pick<Exercise, 'name' | 'muscles'>> = {
  squat: { name: 'Barbell Squat', muscles: ['quads', 'glutes'] },
  bench: { name: 'Bench Press', muscles: ['chest', 'triceps'] },
  fly: { name: 'Cable Fly', muscles: ['chest'] },
  row: { name: 'Barbell Row', muscles: ['lats', 'biceps'] },
  curl: { name: 'Curl', muscles: ['biceps'] },
};
const get = (id: string) => exercises[id];

describe('templateCardModel', () => {
  it('lists names, main muscles once each (max 3) and the size', () => {
    const model = templateCardModel(
      {
        exerciseIds: ['squat', 'bench', 'fly', 'row', 'curl'],
        exercises: [
          { exerciseId: 'squat', sets: 5 },
          { exerciseId: 'bench', sets: 5 },
          { exerciseId: 'fly', sets: 3 },
          { exerciseId: 'row', sets: 5 },
          { exerciseId: 'curl', sets: 3 },
        ],
      },
      get
    );
    expect(model.exerciseNames).toEqual(['Barbell Squat', 'Bench Press', 'Cable Fly', 'Barbell Row', 'Curl']);
    expect(model.muscles.map((m) => m.id)).toEqual(['quads', 'chest', 'lats']);
    expect(model.muscles[0].label).toBe('Quads');
    expect(model.meta).toBe('5 exercises · 21 sets');
  });

  it('falls back to the id for an unknown exercise, and says 1 exercise · 1 set', () => {
    const model = templateCardModel({ exerciseIds: ['gone'], exercises: [{ exerciseId: 'gone', sets: 1 }] }, get);
    expect(model.exerciseNames).toEqual(['gone']);
    expect(model.muscles).toEqual([]);
    expect(model.meta).toBe('1 exercise · 1 set');
  });
});
