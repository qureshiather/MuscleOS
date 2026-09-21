import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '@muscleos/types';
import {
  DEFAULT_SETS_PER_EXERCISE,
  formatTemplateSetLabel,
  normalizeWorkoutTemplate,
  resolveTemplateExercises,
  serializeTemplateExercises,
  templateExercisesFromSession,
} from './templateExercises';

const base = (over: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id: 'tpl_1',
  name: 'Push',
  exerciseIds: ['bench-press', 'ohp'],
  ...over,
});

describe('resolveTemplateExercises', () => {
  it('defaults every exercise to 3 working sets and 0 warm-ups', () => {
    expect(resolveTemplateExercises(base())).toEqual([
      { exerciseId: 'bench-press', sets: DEFAULT_SETS_PER_EXERCISE, warmUpSets: 0 },
      { exerciseId: 'ohp', sets: DEFAULT_SETS_PER_EXERCISE, warmUpSets: 0 },
    ]);
  });

  it('applies legacy defaultSets to every exercise when exercises is absent', () => {
    expect(resolveTemplateExercises(base({ defaultSets: 5 }))).toEqual([
      { exerciseId: 'bench-press', sets: 5, warmUpSets: 0 },
      { exerciseId: 'ohp', sets: 5, warmUpSets: 0 },
    ]);
  });

  it('uses per-exercise sets and warm-ups, treating omitted fields as 3 / 0', () => {
    expect(
      resolveTemplateExercises(
        base({
          defaultSets: 5,
          exercises: [
            { exerciseId: 'bench-press', sets: 4, warmUpSets: 2 },
            { exerciseId: 'ohp' },
          ],
        })
      )
    ).toEqual([
      { exerciseId: 'bench-press', sets: 4, warmUpSets: 2 },
      { exerciseId: 'ohp', sets: 3, warmUpSets: 0 },
    ]);
  });

  it('does not let leftover defaultSets override omitted per-exercise sets', () => {
    const resolved = resolveTemplateExercises(
      base({
        defaultSets: 5,
        exercises: [{ exerciseId: 'bench-press' }, { exerciseId: 'ohp', sets: 4 }],
      })
    );
    expect(resolved[0].sets).toBe(3);
    expect(resolved[1].sets).toBe(4);
  });

  it('clamps working sets to at least 1 and warm-ups to at least 0', () => {
    expect(
      resolveTemplateExercises(
        base({
          exerciseIds: ['a'],
          exercises: [{ exerciseId: 'a', sets: 0, warmUpSets: -2 }],
        })
      )
    ).toEqual([{ exerciseId: 'a', sets: 1, warmUpSets: 0 }]);
  });
});

describe('serializeTemplateExercises', () => {
  it('writes a compact exercises array even when every slot is 3 / 0', () => {
    expect(
      serializeTemplateExercises([
        { exerciseId: 'a', sets: 3, warmUpSets: 0 },
        { exerciseId: 'b', sets: 3, warmUpSets: 0 },
      ])
    ).toEqual({
      exerciseIds: ['a', 'b'],
      exercises: [{ exerciseId: 'a' }, { exerciseId: 'b' }],
    });
  });

  it('keeps non-default set and warm-up counts on the slots that have them', () => {
    expect(
      serializeTemplateExercises([
        { exerciseId: 'a', sets: 5, warmUpSets: 1 },
        { exerciseId: 'b', sets: 3, warmUpSets: 0 },
      ])
    ).toEqual({
      exerciseIds: ['a', 'b'],
      exercises: [{ exerciseId: 'a', sets: 5, warmUpSets: 1 }, { exerciseId: 'b' }],
    });
  });
});

describe('normalizeWorkoutTemplate', () => {
  it('expands legacy defaultSets into exercises and drops defaultSets', () => {
    const next = normalizeWorkoutTemplate(base({ defaultSets: 5 }));
    expect(next.defaultSets).toBeUndefined();
    expect(next.exercises).toEqual([
      { exerciseId: 'bench-press', sets: 5 },
      { exerciseId: 'ohp', sets: 5 },
    ]);
  });

  it('expands a 3-set defaultSets template into compact exercises', () => {
    const next = normalizeWorkoutTemplate(base({ defaultSets: 3 }));
    expect(next.defaultSets).toBeUndefined();
    expect(next.exercises).toEqual([{ exerciseId: 'bench-press' }, { exerciseId: 'ohp' }]);
  });
});

describe('templateExercisesFromSession', () => {
  it('counts warm-up vs working rows, keeping at least one working set', () => {
    expect(
      templateExercisesFromSession([
        {
          exerciseId: 'bench-press',
          sets: [
            { isWarmUp: true },
            { isWarmUp: true },
            {},
            {},
            {},
          ],
        },
        { exerciseId: 'ohp', sets: [{ isWarmUp: true }] },
      ])
    ).toEqual([
      { exerciseId: 'bench-press', sets: 3, warmUpSets: 2 },
      { exerciseId: 'ohp', sets: 1, warmUpSets: 1 },
    ]);
  });
});

describe('formatTemplateSetLabel', () => {
  it('names working sets, and warm-ups when present', () => {
    expect(formatTemplateSetLabel(3, 0)).toBe('3 sets');
    expect(formatTemplateSetLabel(1, 0)).toBe('1 set');
    expect(formatTemplateSetLabel(5, 1)).toBe('1 warm-up · 5 sets');
    expect(formatTemplateSetLabel(3, 2)).toBe('2 warm-ups · 3 sets');
  });
});
