import type { Exercise } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { buildCustomExerciseDraft, resolveExerciseEditTarget } from './customExerciseForm';
import { isCustomExerciseId } from './exerciseIds';

const custom: Exercise = {
  id: 'custom_2',
  name: 'Landmine Thing',
  muscles: ['chest'],
  equipment: [],
  category: 'free_weight',
};
const catalog: Exercise = {
  id: 'bench-press',
  name: 'Barbell Bench Press',
  muscles: ['chest'],
  equipment: ['barbell'],
  category: 'free_weight',
};

describe('isCustomExerciseId', () => {
  it('identifies customs by the custom_ prefix', () => {
    expect(isCustomExerciseId('custom_1')).toBe(true);
    expect(isCustomExerciseId('bench-press')).toBe(false);
  });
});

describe('resolveExerciseEditTarget', () => {
  it('edits a custom exercise', () => {
    expect(resolveExerciseEditTarget('custom_2', custom)).toBe(custom);
  });

  it('ignores catalog ids so a deep link cannot clone a catalog exercise', () => {
    expect(resolveExerciseEditTarget('bench-press', catalog)).toBeUndefined();
  });

  it('ignores a custom-looking id that resolved to another row, unknown ids and no id', () => {
    expect(resolveExerciseEditTarget('custom_9', catalog)).toBeUndefined();
    expect(resolveExerciseEditTarget('custom_9', undefined)).toBeUndefined();
    expect(resolveExerciseEditTarget(undefined, custom)).toBeUndefined();
  });
});

describe('buildCustomExerciseDraft', () => {
  const valid = {
    name: '  Cable Row  ',
    category: 'cable' as const,
    muscles: ['lats' as const],
    equipment: [],
    instructions: '',
  };

  it('builds a trimmed exercise from a valid form', () => {
    expect(buildCustomExerciseDraft(valid)).toEqual({
      ok: true,
      exercise: {
        name: 'Cable Row',
        category: 'cable',
        muscles: ['lats'],
        equipment: [],
        instructions: undefined,
      },
    });
  });

  it('keeps trimmed instructions and equipment', () => {
    const draft = buildCustomExerciseDraft({
      ...valid,
      equipment: ['cable'],
      instructions: '  Pull to the hip. ',
    });
    expect(draft.ok && draft.exercise).toMatchObject({
      equipment: ['cable'],
      instructions: 'Pull to the hip.',
    });
  });

  it('requires a non-blank name, a Type and at least one muscle', () => {
    expect(buildCustomExerciseDraft({ ...valid, name: '   ' })).toEqual({ ok: false, errors: ['name'] });
    expect(buildCustomExerciseDraft({ ...valid, category: null })).toEqual({
      ok: false,
      errors: ['category'],
    });
    expect(buildCustomExerciseDraft({ ...valid, muscles: [] })).toEqual({
      ok: false,
      errors: ['muscles'],
    });
    expect(
      buildCustomExerciseDraft({ name: '', category: null, muscles: [], equipment: [], instructions: '' })
    ).toEqual({ ok: false, errors: ['name', 'category', 'muscles'] });
  });

  it('has no maximum name length', () => {
    const long = 'x'.repeat(500);
    const draft = buildCustomExerciseDraft({ ...valid, name: long });
    expect(draft.ok && draft.exercise.name).toBe(long);
  });
});
