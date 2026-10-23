import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '@muscleos/types';
import {
  DEFAULT_SETS_PER_EXERCISE,
  formatTemplateRestLabel,
  formatTemplateSetLabel,
  normalizeWorkoutTemplate,
  resolveTemplateExercises,
  serializeTemplateExercises,
  templateExercisesFromSession,
  applyRestToAll,
  editorRestPatch,
  sharedRest,
  workRestOverride,
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

describe('template rests (MUS-143)', () => {
  it('resolves a slot\'s rests, clamped, and leaves unset rests implicit', () => {
    const plan = resolveTemplateExercises(
      base({
        exercises: [
          { exerciseId: 'bench-press', restBetweenSetsSeconds: 90, warmUpRestSeconds: 45 },
          { exerciseId: 'ohp', restBetweenSetsSeconds: 99_999 },
        ],
      })
    );
    expect(plan[0]).toMatchObject({ restBetweenSetsSeconds: 90, warmUpRestSeconds: 45 });
    expect(plan[1].restBetweenSetsSeconds).toBe(900);
    expect(plan[1].warmUpRestSeconds).toBeUndefined();
  });

  it('keeps an explicit work rest, 0:00 and 2:00 included, and drops an empty warm-up rest when saving', () => {
    const saved = serializeTemplateExercises([
      { exerciseId: 'a', sets: 3, warmUpSets: 0, restBetweenSetsSeconds: 0 },
      { exerciseId: 'b', sets: 3, warmUpSets: 0, restBetweenSetsSeconds: 120, warmUpRestSeconds: 0 },
      { exerciseId: 'c', sets: 3, warmUpSets: 0 },
    ]);
    expect(saved.exercises).toEqual([
      { exerciseId: 'a', restBetweenSetsSeconds: 0 },
      { exerciseId: 'b', restBetweenSetsSeconds: 120 },
      { exerciseId: 'c' },
    ]);
  });

  it('survives normalizing (every custom-template write)', () => {
    const t = base({ exercises: [{ exerciseId: 'bench-press', restBetweenSetsSeconds: 150 }, { exerciseId: 'ohp' }] });
    expect(normalizeWorkoutTemplate(t).exercises?.[0]).toEqual({ exerciseId: 'bench-press', restBetweenSetsSeconds: 150 });
  });

  it('carries a session\'s rests into Save as template / Overwrite', () => {
    const plan = templateExercisesFromSession([
      { exerciseId: 'a', sets: [{}, {}], restBetweenSetsSeconds: 60, warmUpRestSeconds: 30 },
      { exerciseId: 'b', sets: [{}] },
    ]);
    expect(plan[0]).toMatchObject({ restBetweenSetsSeconds: 60, warmUpRestSeconds: 30 });
    expect(plan[1].restBetweenSetsSeconds).toBeUndefined();
  });

  it('labels the rest pill: work rest, Off for 0:00, and the warm-up rest when set', () => {
    expect(formatTemplateRestLabel({})).toBe('2:00');
    expect(formatTemplateRestLabel({ restBetweenSetsSeconds: 90 })).toBe('1:30');
    expect(formatTemplateRestLabel({ restBetweenSetsSeconds: 0 })).toBe('Off');
    expect(formatTemplateRestLabel({ warmUpRestSeconds: 45 })).toBe('2:00 · warm-up 0:45');
  });
});

describe('editor rests (MUS-169)', () => {
  const plan = [
    { exerciseId: 'a', sets: 3, warmUpSets: 0 },
    { exerciseId: 'b', sets: 3, warmUpSets: 1, restBetweenSetsSeconds: 90, warmUpRestSeconds: 30 },
  ];

  it('leaves a rest equal to the default unset so it keeps following the default', () => {
    expect(editorRestPatch(180, 0, 180)).toEqual({ restBetweenSetsSeconds: undefined, warmUpRestSeconds: undefined });
    expect(editorRestPatch(120, 45, 180)).toEqual({ restBetweenSetsSeconds: 120, warmUpRestSeconds: 45 });
    expect(editorRestPatch(0, 0, 180)).toEqual({ restBetweenSetsSeconds: 0, warmUpRestSeconds: undefined });
  });

  it('keeps an explicit 0:00 even when the default is Off, so it stays off if the default changes', () => {
    expect(workRestOverride(0, 0)).toBe(0);
    expect(workRestOverride(120, 120)).toBeUndefined();
    expect(workRestOverride(90, 120)).toBe(90);
  });

  it('Rest for all sets every slot', () => {
    const all = applyRestToAll(plan, 150, 60, 120);
    expect(all.map((e) => [e.restBetweenSetsSeconds, e.warmUpRestSeconds])).toEqual([
      [150, 60],
      [150, 60],
    ]);
    expect(applyRestToAll(plan, 120, 0, 120).map((e) => e.restBetweenSetsSeconds)).toEqual([undefined, undefined]);
  });

  it('opens with the shared rests, or the default when slots differ', () => {
    expect(sharedRest(plan, 120)).toEqual({ work: 120, warmUp: 0 });
    expect(sharedRest(applyRestToAll(plan, 150, 60, 120), 120)).toEqual({ work: 150, warmUp: 60 });
    expect(sharedRest([plan[0]], 180)).toEqual({ work: 180, warmUp: 0 });
  });

  it("labels an unset rest with the user's default", () => {
    expect(formatTemplateRestLabel({}, 180)).toBe('3:00');
  });
});
