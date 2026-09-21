import { describe, expect, it } from 'vitest';
import type { SetRecord, SessionExercise } from '@muscleos/types';
import type { PersistedActiveWorkout } from '@/storage/localStorage';
import {
  DEFAULT_SETS_PER_EXERCISE,
  bestCompletedSet,
  buildAddedSet,
  buildPreviousSnapshot,
  buildReplacedExercise,
  bumpRestKeysForInsertedSet,
  canCompleteSet,
  completeSetInSets,
  createEmptySession,
  createPrefillingSets,
  dropRestKeysForExercise,
  dropRestKeysForRemovedSet,
  encodeStartParams,
  normalizeHydratedState,
  oldToNewForRemove,
  oldToNewForReorder,
  parseStartParams,
  remapRestAfter,
  remapRestDurations,
  shouldStartRestAfterComplete,
  startPrefillPatch,
  stripPrefillFlags,
} from './activeWorkoutLogic';

describe('createEmptySession', () => {
  it('creates 3 blank working sets per exercise by default', () => {
    const s = createEmptySession(
      '_empty',
      [{ exerciseId: 'a' }, { exerciseId: 'b' }],
      1000
    );
    expect(s.templateId).toBe('_empty');
    expect(s.id).toBe('session_1000');
    expect(s.exercises).toHaveLength(2);
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets.every((set) => set.completed === false && set.isWarmUp !== true)).toBe(
      true
    );
    expect(s.completedAt).toBeUndefined();
  });

  it('honours per-exercise working sets (e.g. Strong Lifts 5x5)', () => {
    const s = createEmptySession('sl-a', [{ exerciseId: 'squat', sets: 5 }], 1000);
    expect(s.exercises[0].sets).toHaveLength(5);
    expect(s.exercises[0].sets.every((set) => set.isWarmUp !== true)).toBe(true);
  });

  it('prepends warm-up rows before working sets', () => {
    const s = createEmptySession(
      't',
      [{ exerciseId: 'bench-press', sets: 3, warmUpSets: 2 }],
      1000
    );
    expect(s.exercises[0].sets).toEqual([
      { completed: false, isWarmUp: true },
      { completed: false, isWarmUp: true },
      { completed: false },
      { completed: false },
      { completed: false },
    ]);
  });

  it('gives every exercise its own independent set objects', () => {
    const s = createEmptySession(
      't',
      [
        { exerciseId: 'a', sets: 2 },
        { exerciseId: 'b', sets: 2 },
      ],
      1000
    );
    s.exercises[0].sets[0].completed = true;
    expect(s.exercises[1].sets[0].completed).toBe(false);
  });
});

describe('completeSetInSets', () => {
  const sets: SetRecord[] = [
    { completed: false, weightKg: 100, reps: 5 },
    { completed: false },
    { completed: false },
  ];

  it('marks the target set completed without mutating the input', () => {
    const next = completeSetInSets(sets, 0);
    expect(next[0].completed).toBe(true);
    expect(sets[0].completed).toBe(false); // original untouched
  });

  it('copies the completed weight into the next empty set, but not reps', () => {
    const next = completeSetInSets(sets, 0);
    expect(next[1].weightKg).toBe(100);
    expect(next[1].reps).toBeUndefined();
  });

  it('does not overwrite a next set that already has a weight', () => {
    const withWeight: SetRecord[] = [
      { completed: false, weightKg: 100 },
      { completed: false, weightKg: 60 },
    ];
    expect(completeSetInSets(withWeight, 0)[1].weightKg).toBe(60);
  });

  it('does not carry weight across the warm-up / working boundary', () => {
    const mixed: SetRecord[] = [
      { completed: false, weightKg: 40, isWarmUp: true },
      { completed: false },
    ];
    expect(completeSetInSets(mixed, 0)[1].weightKg).toBeUndefined();
  });

  it('carries weight between two warm-up sets', () => {
    const warmups: SetRecord[] = [
      { completed: false, weightKg: 40, isWarmUp: true },
      { completed: false, isWarmUp: true },
    ];
    expect(completeSetInSets(warmups, 0)[1].weightKg).toBe(40);
  });

  it('clears the completed set suggestion flags and marks the carried weight as a suggestion', () => {
    const suggested: SetRecord[] = [
      { completed: false, weightKg: 100, weightPrefilled: true, reps: 5, repsPrefilled: true },
      { completed: false },
    ];
    const next = completeSetInSets(suggested, 0);
    expect(next[0].weightPrefilled).toBe(false);
    expect(next[0].repsPrefilled).toBe(false);
    expect(next[1].weightKg).toBe(100);
    expect(next[1].weightPrefilled).toBe(true);
  });
});

describe('buildAddedSet', () => {
  it('carries the last set weight and reps forward as suggestions', () => {
    expect(buildAddedSet([{ completed: true, weightKg: 80, reps: 8 }])).toEqual({
      completed: false,
      weightKg: 80,
      weightPrefilled: true,
      reps: 8,
      repsPrefilled: true,
    });
  });

  it('is blank when the last set is blank', () => {
    expect(buildAddedSet([{ completed: false }])).toEqual({ completed: false });
  });
});

describe('bestCompletedSet', () => {
  it('picks the highest weight, then highest reps', () => {
    const best = bestCompletedSet([
      { completed: true, weightKg: 100, reps: 5 },
      { completed: true, weightKg: 100, reps: 8 },
      { completed: true, weightKg: 80, reps: 12 },
    ]);
    expect(best).toEqual({ completed: true, weightKg: 100, reps: 8 });
  });

  it('ignores incomplete sets and zero/undefined weights', () => {
    expect(
      bestCompletedSet([
        { completed: false, weightKg: 200, reps: 5 },
        { completed: true, weightKg: 0, reps: 20 },
        { completed: true, reps: 10 },
      ])
    ).toBeUndefined();
  });
});

describe('buildPreviousSnapshot', () => {
  it('overlays the best weighted set per exercise', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'squat', sets: [{ completed: true, weightKg: 120, reps: 5 }] },
      { exerciseId: 'bench', sets: [{ completed: true, weightKg: 80, reps: 8 }] },
    ];
    expect(buildPreviousSnapshot(exercises, {})).toEqual({
      squat: { weightKg: 120, reps: 5 },
      bench: { weightKg: 80, reps: 8 },
    });
  });

  it('keeps a prior snapshot when the exercise had no qualifying set this session', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'squat', sets: [{ completed: false, weightKg: 200, reps: 1 }] },
    ];
    expect(buildPreviousSnapshot(exercises, { squat: { weightKg: 100, reps: 5 } })).toEqual({
      squat: { weightKg: 100, reps: 5 },
    });
  });

  it('can move a snapshot down after a lighter session', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'squat', sets: [{ completed: true, weightKg: 90, reps: 5 }] },
    ];
    expect(buildPreviousSnapshot(exercises, { squat: { weightKg: 140, reps: 3 } })).toEqual({
      squat: { weightKg: 90, reps: 5 },
    });
  });
});

describe('rest-key remapping', () => {
  it('oldToNewForRemove maps the removed slot to -1 and shifts the rest down', () => {
    expect(oldToNewForRemove(4, 1)).toEqual([0, -1, 1, 2]);
  });

  it('oldToNewForReorder handles moving down and up', () => {
    // move index 0 to 2: [1,2,0,3] positions
    expect(oldToNewForReorder(4, 0, 2)).toEqual([2, 0, 1, 3]);
    // move index 3 to 1
    expect(oldToNewForReorder(4, 3, 1)).toEqual([0, 2, 3, 1]);
  });

  it('remapRestDurations moves keys to their new exercise index and drops removed ones', () => {
    const durations = { '0-0': 90, '1-0': 120, '2-1': 180 };
    // remove exercise 1
    expect(remapRestDurations(durations, oldToNewForRemove(3, 1))).toEqual({
      '0-0': 90,
      '1-1': 180,
    });
  });

  it('remapRestAfter follows the moved exercise and clears when removed', () => {
    expect(remapRestAfter({ exIdx: 2, setIdx: 1 }, oldToNewForRemove(3, 1))).toEqual({
      exIdx: 1,
      setIdx: 1,
    });
    expect(remapRestAfter({ exIdx: 1, setIdx: 0 }, oldToNewForRemove(3, 1))).toBeNull();
  });

  it('bumpRestKeysForInsertedSet shifts an exercise’s set keys up by one (warm-up inserted at 0)', () => {
    expect(bumpRestKeysForInsertedSet({ '0-0': 90, '0-1': 120, '1-0': 60 }, 0)).toEqual({
      '0-1': 90,
      '0-2': 120,
      '1-0': 60,
    });
  });

  it('dropRestKeysForRemovedSet removes the set and shifts later keys of that exercise down', () => {
    expect(dropRestKeysForRemovedSet({ '0-0': 90, '0-1': 120, '0-2': 180, '1-0': 60 }, 0, 1)).toEqual({
      '0-0': 90,
      '0-1': 180,
      '1-0': 60,
    });
  });

  it('dropRestKeysForExercise drops every rest key for that index and leaves others', () => {
    expect(dropRestKeysForExercise({ '0-0': 90, '0-1': 120, '1-0': 60 }, 0)).toEqual({ '1-0': 60 });
  });
});

describe('canCompleteSet', () => {
  it('requires a positive rep count; weight is optional', () => {
    expect(canCompleteSet({ reps: 5 })).toBe(true);
    expect(canCompleteSet({ reps: 0 })).toBe(false);
    expect(canCompleteSet({ reps: undefined })).toBe(false);
  });
});

describe('shouldStartRestAfterComplete', () => {
  it('starts rest for a working set but not a warm-up', () => {
    expect(shouldStartRestAfterComplete({})).toBe(true);
    expect(shouldStartRestAfterComplete({ isWarmUp: false })).toBe(true);
    expect(shouldStartRestAfterComplete({ isWarmUp: true })).toBe(false);
  });
});

describe('startPrefillPatch', () => {
  const previous = { weightKg: 80, reps: 8 };

  it('prefills a completely empty set from the previous snapshot, flagged as a suggestion', () => {
    expect(startPrefillPatch({}, previous)).toEqual({
      weightKg: 80,
      weightPrefilled: true,
      reps: 8,
      repsPrefilled: true,
    });
  });

  it('flags only weight when the snapshot has no reps', () => {
    expect(startPrefillPatch({}, { weightKg: 80 })).toEqual({
      weightKg: 80,
      weightPrefilled: true,
    });
  });

  it('leaves partially filled sets alone', () => {
    expect(startPrefillPatch({ weightKg: 60 }, previous)).toBeNull();
    expect(startPrefillPatch({ reps: 3 }, previous)).toBeNull();
  });

  it('does nothing when there is no previous snapshot', () => {
    expect(startPrefillPatch({}, undefined)).toBeNull();
  });

  it('does not prefill warm-up sets from the previous working snapshot', () => {
    expect(startPrefillPatch({ isWarmUp: true }, previous)).toBeNull();
  });
});

describe('createPrefillingSets', () => {
  it('creates the default number of blank sets when there is no previous snapshot', () => {
    expect(createPrefillingSets()).toEqual([
      { completed: false },
      { completed: false },
      { completed: false },
    ]);
    expect(createPrefillingSets(undefined, DEFAULT_SETS_PER_EXERCISE)).toHaveLength(3);
  });

  it('prefills every set from the previous snapshot, flagged as suggestions', () => {
    expect(createPrefillingSets({ weightKg: 30, reps: 10 }, 2)).toEqual([
      {
        completed: false,
        weightKg: 30,
        weightPrefilled: true,
        reps: 10,
        repsPrefilled: true,
      },
      {
        completed: false,
        weightKg: 30,
        weightPrefilled: true,
        reps: 10,
        repsPrefilled: true,
      },
    ]);
  });
});

describe('buildReplacedExercise', () => {
  const current: SessionExercise = {
    exerciseId: 'leg-extension',
    restBetweenSetsSeconds: 90,
    sets: [
      { completed: true, weightKg: 50, reps: 12 },
      { completed: false, weightKg: 50, reps: 12, weightPrefilled: true, repsPrefilled: true },
      { completed: false, isWarmUp: true, weightKg: 20 },
    ],
  };

  it('swaps the id and prefills default sets from the new exercise previous, not the old one', () => {
    const next = buildReplacedExercise(current, 'lying-leg-curl', { weightKg: 30, reps: 10 });
    expect(next.exerciseId).toBe('lying-leg-curl');
    expect(next.restBetweenSetsSeconds).toBe(90);
    expect(next.sets).toHaveLength(DEFAULT_SETS_PER_EXERCISE);
    expect(next.sets.every((s) => s.completed === false && s.isWarmUp !== true)).toBe(true);
    expect(next.sets.every((s) => s.weightKg === 30 && s.reps === 10)).toBe(true);
    expect(next.sets.some((s) => s.weightKg === 50)).toBe(false);
  });

  it('starts with blank sets when the new exercise has no previous snapshot', () => {
    const next = buildReplacedExercise(current, 'lying-leg-curl');
    expect(next.sets).toEqual([
      { completed: false },
      { completed: false },
      { completed: false },
    ]);
  });
});

describe('stripPrefillFlags', () => {
  it('removes prefill flags from every set without mutating the input', () => {
    const session = createEmptySession('t', [{ exerciseId: 'a', sets: 1 }], 1000);
    session.exercises[0].sets[0] = {
      completed: false,
      weightKg: 80,
      weightPrefilled: true,
      reps: 8,
      repsPrefilled: true,
    };
    const stripped = stripPrefillFlags(session);
    expect(stripped.exercises[0].sets[0]).toEqual({ completed: false, weightKg: 80, reps: 8 });
    // input untouched
    expect(session.exercises[0].sets[0].weightPrefilled).toBe(true);
  });
});

describe('parseStartParams', () => {
  it('splits a comma-separated exercise id list, dropping blanks', () => {
    expect(parseStartParams({ exerciseIds: 'a,b,,c' }).map((p) => p.exerciseId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(parseStartParams({}).map((p) => p.exerciseId)).toEqual([]);
  });

  it('uses per-exercise sets and warm-ups, defaulting to 3 / 0', () => {
    expect(parseStartParams({ exerciseIds: 'a,b', sets: '4,5', warmUpSets: '1,0' })).toEqual([
      { exerciseId: 'a', sets: 4, warmUpSets: 1 },
      { exerciseId: 'b', sets: 5, warmUpSets: 0 },
    ]);
    expect(parseStartParams({ exerciseIds: 'a' })).toEqual([
      { exerciseId: 'a', sets: 3, warmUpSets: 0 },
    ]);
  });

  it('falls back to a positive defaultSets when the sets list is absent', () => {
    expect(parseStartParams({ exerciseIds: 'a,b', defaultSets: '5' })).toEqual([
      { exerciseId: 'a', sets: 5, warmUpSets: 0 },
      { exerciseId: 'b', sets: 5, warmUpSets: 0 },
    ]);
    expect(parseStartParams({ exerciseIds: 'a', defaultSets: '0' })[0].sets).toBe(3);
    expect(parseStartParams({ exerciseIds: 'a', defaultSets: 'abc' })[0].sets).toBe(3);
  });
});

describe('encodeStartParams', () => {
  it('omits sets and warm-ups when every slot is the 3 / 0 default', () => {
    expect(
      encodeStartParams([
        { exerciseId: 'a', sets: 3, warmUpSets: 0 },
        { exerciseId: 'b', sets: 3, warmUpSets: 0 },
      ])
    ).toEqual({ exerciseIds: 'a,b' });
  });

  it('writes parallel count lists when any slot is non-default', () => {
    expect(
      encodeStartParams([
        { exerciseId: 'a', sets: 5, warmUpSets: 2 },
        { exerciseId: 'b', sets: 3, warmUpSets: 0 },
      ])
    ).toEqual({ exerciseIds: 'a,b', sets: '5,3', warmUpSets: '2,0' });
  });
});

describe('normalizeHydratedState', () => {
  const saved: PersistedActiveWorkout = {
    session: {
      id: 'session_1',
      templateId: 'ppl-push',
      startedAt: '2026-01-01T10:00:00.000Z',
      exercises: [{ exerciseId: 'bench-press', sets: [{ completed: false }] }],
    },
    restEndTime: 10_000,
    restTotalSeconds: 90,
    restAfter: { exIdx: 0, setIdx: 0 },
    restDurationsBetweenSets: { '0-0': 60 },
  };

  it('keeps a rest timer that has not yet expired', () => {
    const state = normalizeHydratedState(saved, 5_000);
    expect(state.restEndTime).toBe(10_000);
    expect(state.restAfter).toEqual({ exIdx: 0, setIdx: 0 });
  });

  it('discards a rest timer that expired while the app was dead', () => {
    const state = normalizeHydratedState(saved, 20_000);
    expect(state.restEndTime).toBeNull();
    expect(state.restAfter).toBeNull();
  });

  it('falls back to defaults for missing rest fields', () => {
    const bare = {
      session: saved.session,
      restEndTime: null,
      restTotalSeconds: undefined,
      restAfter: undefined,
      restDurationsBetweenSets: undefined,
    } as unknown as PersistedActiveWorkout;
    const state = normalizeHydratedState(bare, 0);
    expect(state.restTotalSeconds).toBe(120);
    expect(state.restAfter).toBeNull();
    expect(state.restDurationsBetweenSets).toEqual({});
  });
});
