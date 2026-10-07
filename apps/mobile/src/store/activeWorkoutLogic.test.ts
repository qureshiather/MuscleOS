import { describe, expect, it } from 'vitest';
import type { SetRecord, SessionExercise, WorkoutSession } from '@muscleos/types';
import type { PersistedActiveWorkout } from '@/storage/localStorage';
import {
  DEFAULT_SETS_PER_EXERCISE,
  REST_MAX_SECONDS,
  REST_MIN_SECONDS,
  REST_END_SOUND_GRACE_MS,
  STALE_WORKOUT_MS,
  adjustRunningRest,
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
  prefillSession,
  rebuildPreviousSnapshot,
  remapRestAfter,
  remapRestDurations,
  resolveRestEnd,
  resolveStaleWorkout,
  restDurationAfterComplete,
  restSecondsLeft,
  restTakenSeconds,
  sessionHasExercise,
  shouldPlayRestTick,
  storedRestSeconds,
  startPrefillPatch,
  completeSession,
  stripPrefillFlags,
} from './activeWorkoutLogic';

describe('adjustRunningRest (header ±30)', () => {
  const NOW = 1_000_000;
  const running = (total: number, leftSec: number) => ({ endTime: NOW + leftSec * 1000, total });

  it('+30 adds 30 s to the total and the end time, off-grid totals included', () => {
    expect(adjustRunningRest(running(120, 50), 1, NOW)).toEqual(running(150, 80));
    expect(adjustRunningRest(running(100, 10), 1, NOW)).toEqual(running(130, 40));
  });

  it('+30 caps the total at 15:00', () => {
    expect(adjustRunningRest(running(REST_MAX_SECONDS - 10, 100), 1, NOW)).toEqual(
      running(REST_MAX_SECONDS, 110)
    );
    expect(adjustRunningRest(running(REST_MAX_SECONDS, 100), 1, NOW)).toEqual(
      running(REST_MAX_SECONDS, 100)
    );
  });

  it('−30 removes 30 s from the total and the end time', () => {
    expect(adjustRunningRest(running(120, 100), -1, NOW)).toEqual(running(90, 70));
  });

  it('−30 never takes the total below 30 s', () => {
    expect(adjustRunningRest(running(40, 35), -1, NOW)).toEqual(running(REST_MIN_SECONDS, 25));
  });

  it('−30 at a 30 s total does nothing, so the progress bar never jumps', () => {
    const r = running(REST_MIN_SECONDS, 25);
    const next = adjustRunningRest(r, -1, NOW);
    expect(next).toEqual(r);
    // progress = (total − left) / total is unchanged
    expect((next.total - 25) / next.total).toBe((r.total - 25) / r.total);
  });

  it('−30 never leaves less than 1 s on the clock', () => {
    // 10 s left: only 9 s can come off.
    const next = adjustRunningRest(running(120, 10), -1, NOW);
    expect(next.endTime - NOW).toBe(1000);
    expect(next.total).toBe(111);
  });

  it('keeps total = time rested + time left, so the recorded duration stays true', () => {
    // 110 s rested, 10 s left; after −30 the rest that gets recorded is 110 + 1.
    const next = adjustRunningRest(running(120, 10), -1, NOW);
    expect(next.total - (next.endTime - NOW) / 1000).toBe(110);
  });
});

describe('restTakenSeconds / restSecondsLeft', () => {
  it('skip records total minus the whole seconds left (rounded up)', () => {
    expect(restTakenSeconds(120, 10_000 + 90_500, 10_000)).toBe(29);
    expect(restTakenSeconds(120, 10_000 + 120_000, 10_000)).toBe(0);
  });

  it('never records a negative duration', () => {
    expect(restTakenSeconds(30, 10_000 + 60_000, 10_000)).toBe(0);
  });

  it('shows remaining seconds rounded up, 0 once past, null with no timer', () => {
    expect(restSecondsLeft(10_000 + 1_200, 10_000)).toBe(2);
    expect(restSecondsLeft(10_000, 20_000)).toBe(0);
    expect(restSecondsLeft(null, 10_000)).toBeNull();
  });
});

describe('resolveRestEnd', () => {
  const restAfter = { exIdx: 1, setIdx: 2 };

  it('is null while the countdown is still running, or none is', () => {
    expect(resolveRestEnd({ restEndTime: 5_000, restAfter, total: 90 }, 4_999)).toBeNull();
    expect(resolveRestEnd({ restEndTime: null, restAfter, total: 90 }, 4_999)).toBeNull();
  });

  it('records the full duration against the set the rest followed', () => {
    expect(resolveRestEnd({ restEndTime: 5_000, restAfter, total: 90 }, 5_000)).toEqual({
      record: { exIdx: 1, setIdx: 2, seconds: 90 },
      playEndSound: true,
    });
  });

  it('records nothing for a manual rest (no set)', () => {
    expect(resolveRestEnd({ restEndTime: 5_000, restAfter: null, total: 60 }, 5_100)).toEqual({
      playEndSound: true,
    });
  });

  it('plays the end sound only within the 1500 ms grace window', () => {
    expect(REST_END_SOUND_GRACE_MS).toBe(1500);
    const at = (now: number) =>
      resolveRestEnd({ restEndTime: 5_000, restAfter, total: 90 }, now)?.playEndSound;
    expect(at(5_000 + 1_499)).toBe(true);
    expect(at(5_000 + 1_500)).toBe(false);
    expect(at(5_000 + 60_000)).toBe(false);
  });
});

describe('shouldPlayRestTick', () => {
  it('ticks at 3, 2 and 1 seconds left', () => {
    expect(shouldPlayRestTick(4, 3)).toBe(true);
    expect(shouldPlayRestTick(3, 2)).toBe(true);
    expect(shouldPlayRestTick(2, 1)).toBe(true);
    expect(shouldPlayRestTick(null, 2)).toBe(true);
  });

  it('is silent outside 1–3 and on re-renders within the same second', () => {
    expect(shouldPlayRestTick(5, 4)).toBe(false);
    expect(shouldPlayRestTick(1, 0)).toBe(false);
    expect(shouldPlayRestTick(3, 3)).toBe(false);
    // +30 while ticking jumps up: no tick until it counts back down
    expect(shouldPlayRestTick(2, 3)).toBe(false);
  });
});

describe('prefillSession (session start)', () => {
  const session: WorkoutSession = {
    id: 's',
    templateId: 't',
    startedAt: '2026-01-01T00:00:00.000Z',
    exercises: [
      {
        exerciseId: 'bench',
        sets: [
          { completed: false, isWarmUp: true },
          { completed: false },
          { completed: false, weightKg: 50 },
        ],
      },
      { exerciseId: 'row', sets: [{ completed: false }] },
    ],
  };

  it('fills only completely empty working sets, flagged as suggestions', () => {
    const out = prefillSession(session, { bench: { weightKg: 60, reps: 5 } });
    const [warm, empty, partial] = out.exercises[0].sets;
    expect(warm).toEqual({ completed: false, isWarmUp: true });
    expect(empty).toEqual({
      completed: false,
      weightKg: 60,
      weightPrefilled: true,
      reps: 5,
      repsPrefilled: true,
    });
    expect(partial).toEqual({ completed: false, weightKg: 50 });
    // no snapshot → untouched
    expect(out.exercises[1]).toBe(session.exercises[1]);
  });

  it('returns the same session when there is nothing to fill', () => {
    expect(prefillSession(session, {})).toBe(session);
  });
});

describe('sessionHasExercise', () => {
  it('detects an exercise already in the workout', () => {
    const s = createEmptySession('t', [{ exerciseId: 'a' }], 1);
    expect(sessionHasExercise(s, 'a')).toBe(true);
    expect(sessionHasExercise(s, 'b')).toBe(false);
  });
});

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

describe('restDurationAfterComplete', () => {
  it('starts the work-set rest, including the 120s default, and skips an explicit 0:00', () => {
    expect(restDurationAfterComplete({}, {})).toBe(120);
    expect(restDurationAfterComplete({ isWarmUp: false }, { restBetweenSetsSeconds: 75 })).toBe(75);
    expect(restDurationAfterComplete({}, { restBetweenSetsSeconds: 0 })).toBeNull();
  });

  it('starts warm-up rest only when a duration is set', () => {
    expect(restDurationAfterComplete({ isWarmUp: true }, {})).toBeNull();
    expect(restDurationAfterComplete({ isWarmUp: true }, { warmUpRestSeconds: 0 })).toBeNull();
    expect(restDurationAfterComplete({ isWarmUp: true }, { warmUpRestSeconds: 45 })).toBe(45);
  });
});

describe('storedRestSeconds', () => {
  it('keeps a typed clock time, including 0:00, and caps at 15:00', () => {
    expect(storedRestSeconds(0)).toBe(0);
    expect(storedRestSeconds(75)).toBe(75);
    expect(storedRestSeconds(REST_MAX_SECONDS + 30)).toBe(REST_MAX_SECONDS);
    expect(storedRestSeconds(Number.NaN)).toBe(0);
    expect(storedRestSeconds(-10)).toBe(0);
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
    warmUpRestSeconds: 45,
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
    expect(next.warmUpRestSeconds).toBe(45);
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

describe('completeSession', () => {
  const base = createEmptySession('_empty', [{ exerciseId: 'bench-press', sets: 1 }]);

  it('sets completedAt, strips prefill flags and keeps the template by default', () => {
    const session = {
      ...base,
      exercises: base.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((st) => ({ ...st, weightKg: 60, weightPrefilled: true })),
      })),
    };
    const done = completeSession(session, '2026-01-01T11:00:00.000Z');
    expect(done.completedAt).toBe('2026-01-01T11:00:00.000Z');
    expect(done.templateId).toBe('_empty');
    expect(done.exercises[0]?.sets[0]).not.toHaveProperty('weightPrefilled');
  });

  it('re-points the session at a template saved from it', () => {
    expect(completeSession(base, '2026-01-01T11:00:00.000Z', 'tpl_new').templateId).toBe('tpl_new');
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

  it('records the expired rest full duration for its set before dropping the timer', () => {
    const state = normalizeHydratedState(saved, 20_000);
    expect(state.restDurationsBetweenSets).toEqual({ '0-0': 90 });
    // input untouched
    expect(saved.restDurationsBetweenSets).toEqual({ '0-0': 60 });
  });

  it('records nothing for an expired manual rest', () => {
    const state = normalizeHydratedState({ ...saved, restAfter: null }, 20_000);
    expect(state.restDurationsBetweenSets).toEqual({ '0-0': 60 });
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

  it('keeps a persisted lastActivityAt', () => {
    expect(normalizeHydratedState({ ...saved, lastActivityAt: 1_234 }, 0).lastActivityAt).toBe(1_234);
  });

  it('counts activity from the session start for snapshots that predate lastActivityAt', () => {
    expect(normalizeHydratedState(saved, 0).lastActivityAt).toBe(
      Date.parse('2026-01-01T10:00:00.000Z')
    );
  });
});

describe('resolveStaleWorkout', () => {
  const lastActivityAt = Date.parse('2026-01-01T11:00:00.000Z');
  const session = (completed: boolean) => ({
    id: 'session_1',
    templateId: 'ppl-push',
    startedAt: '2026-01-01T10:00:00.000Z',
    exercises: [
      { exerciseId: 'bench-press', sets: [{ completed, reps: 5, weightKg: 60 }, { completed: false }] },
    ],
  });

  it('leaves a workout alone until it has been idle for the full threshold', () => {
    expect(resolveStaleWorkout(session(true), lastActivityAt, lastActivityAt)).toBeNull();
    expect(
      resolveStaleWorkout(session(true), lastActivityAt, lastActivityAt + STALE_WORKOUT_MS - 1)
    ).toBeNull();
  });

  it('finishes a stale workout as of its last activity, not now', () => {
    expect(
      resolveStaleWorkout(session(true), lastActivityAt, lastActivityAt + 2 * 24 * 60 * 60 * 1000)
    ).toEqual({ kind: 'finish', completedAt: '2026-01-01T11:00:00.000Z' });
  });

  it('discards a stale workout with no completed sets', () => {
    expect(
      resolveStaleWorkout(session(false), lastActivityAt, lastActivityAt + STALE_WORKOUT_MS)
    ).toEqual({ kind: 'discard' });
  });

  it('uses a three-hour threshold', () => {
    expect(STALE_WORKOUT_MS).toBe(3 * 60 * 60 * 1000);
  });
});

describe('rebuildPreviousSnapshot (after a session is deleted)', () => {
  const done = (id: string, completedAt: string | undefined, sets: SetRecord[]): WorkoutSession => ({
    id,
    templateId: 't',
    startedAt: '2026-01-01T09:00:00.000Z',
    ...(completedAt && { completedAt }),
    exercises: [{ exerciseId: 'bench', sets }],
  });

  it('takes the best weighted set from the most recent qualifying session, not the all-time best', () => {
    const prev = rebuildPreviousSnapshot([
      done('old', '2026-01-01T10:00:00.000Z', [{ completed: true, weightKg: 100, reps: 5 }]),
      done('new', '2026-01-05T10:00:00.000Z', [
        { completed: true, weightKg: 80, reps: 5 },
        { completed: true, weightKg: 80, reps: 8 },
      ]),
    ]);
    expect(prev.bench).toEqual({ weightKg: 80, reps: 8 });
  });

  it('skips newer sessions with no completed weighted set, and in-progress sessions', () => {
    const prev = rebuildPreviousSnapshot([
      done('old', '2026-01-01T10:00:00.000Z', [{ completed: true, weightKg: 70, reps: 5 }]),
      done('bodyweight', '2026-01-03T10:00:00.000Z', [{ completed: true, reps: 10 }]),
      done('incomplete', '2026-01-04T10:00:00.000Z', [{ completed: false, weightKg: 90, reps: 5 }]),
      done('live', undefined, [{ completed: true, weightKg: 120, reps: 1 }]),
    ]);
    expect(prev.bench).toEqual({ weightKg: 70, reps: 5 });
  });

  it('drops an exercise with no qualifying set left', () => {
    expect(rebuildPreviousSnapshot([])).toEqual({});
  });
});
