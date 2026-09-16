import { describe, expect, it } from 'vitest';
import type { SetRecord, SessionExercise } from '@muscleos/types';
import type { PersistedActiveWorkout } from '@/storage/localStorage';
import {
  bestCompletedSet,
  buildAddedSet,
  buildPreviousSnapshot,
  bumpRestKeysForInsertedSet,
  canCompleteSet,
  completeSetInSets,
  createEmptySession,
  dropRestKeysForRemovedSet,
  normalizeHydratedState,
  oldToNewForRemove,
  oldToNewForReorder,
  parseStartParams,
  remapRestAfter,
  remapRestDurations,
  shouldStartRestAfterComplete,
  startPrefillPatch,
} from './activeWorkoutLogic';

describe('createEmptySession', () => {
  it('creates 3 blank sets per exercise by default', () => {
    const s = createEmptySession('_empty', ['a', 'b'], undefined, 1000);
    expect(s.templateId).toBe('_empty');
    expect(s.id).toBe('session_1000');
    expect(s.exercises).toHaveLength(2);
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets.every((set) => set.completed === false)).toBe(true);
    expect(s.completedAt).toBeUndefined();
  });

  it('honours defaultSets (e.g. Strong Lifts 5x5)', () => {
    const s = createEmptySession('sl-a', ['squat'], 5, 1000);
    expect(s.exercises[0].sets).toHaveLength(5);
  });

  it('gives every exercise its own independent set objects', () => {
    const s = createEmptySession('t', ['a', 'b'], 2, 1000);
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
});

describe('buildAddedSet', () => {
  it('carries the last set weight and reps forward', () => {
    expect(buildAddedSet([{ completed: true, weightKg: 80, reps: 8 }])).toEqual({
      completed: false,
      weightKg: 80,
      reps: 8,
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

  it('prefills a completely empty set from the previous snapshot', () => {
    expect(startPrefillPatch({}, previous)).toEqual({ weightKg: 80, reps: 8 });
  });

  it('leaves partially filled sets alone', () => {
    expect(startPrefillPatch({ weightKg: 60 }, previous)).toBeNull();
    expect(startPrefillPatch({ reps: 3 }, previous)).toBeNull();
  });

  it('does nothing when there is no previous snapshot', () => {
    expect(startPrefillPatch({}, undefined)).toBeNull();
  });
});

describe('parseStartParams', () => {
  it('splits a comma-separated exercise id list, dropping blanks', () => {
    expect(parseStartParams('a,b,,c').exerciseIds).toEqual(['a', 'b', 'c']);
    expect(parseStartParams(undefined).exerciseIds).toEqual([]);
  });

  it('parses a positive defaultSets and ignores invalid or non-positive values', () => {
    expect(parseStartParams('a', '5').defaultSets).toBe(5);
    expect(parseStartParams('a', '0').defaultSets).toBeUndefined();
    expect(parseStartParams('a', 'abc').defaultSets).toBeUndefined();
    expect(parseStartParams('a', undefined).defaultSets).toBeUndefined();
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
