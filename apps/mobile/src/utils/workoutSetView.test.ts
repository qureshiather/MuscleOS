import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetRecord } from '@muscleos/types';
import {
  activeExerciseIndex,
  firstIncompleteSetIndex,
  isCurrentSet,
  headerRestState,
  previousLabel,
  setLabel,
  setRowView,
} from './workoutSetView';

const done = (over: Partial<SetRecord> = {}): SetRecord => ({ completed: true, ...over });
const todo = (over: Partial<SetRecord> = {}): SetRecord => ({ completed: false, ...over });

describe('setLabel', () => {
  it('numbers working sets 1, 2, 3…', () => {
    const sets = [todo(), todo(), todo()];
    expect(sets.map((_, i) => setLabel(sets, i))).toEqual(['1', '2', '3']);
  });

  it('numbers warm-ups W1, W2… and excludes them from the working count', () => {
    const sets = [todo({ isWarmUp: true }), todo({ isWarmUp: true }), todo(), todo()];
    expect(sets.map((_, i) => setLabel(sets, i))).toEqual(['W1', 'W2', '1', '2']);
  });

  it('keeps working numbering correct when a warm-up is interleaved', () => {
    // A warm-up added after working sets should not renumber the working sets before it.
    const sets = [todo(), todo({ isWarmUp: true }), todo()];
    expect(sets.map((_, i) => setLabel(sets, i))).toEqual(['1', 'W1', '2']);
  });
});

describe('firstIncompleteSetIndex', () => {
  it('returns the first not-done set', () => {
    expect(firstIncompleteSetIndex([done(), todo(), todo()])).toBe(1);
  });

  it('returns -1 when all sets are done', () => {
    expect(firstIncompleteSetIndex([done(), done()])).toBe(-1);
  });
});

describe('activeExerciseIndex', () => {
  it('is the first exercise with an incomplete set', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', sets: [done(), done()] },
      { exerciseId: 'b', sets: [done(), todo()] },
      { exerciseId: 'c', sets: [todo()] },
    ];
    expect(activeExerciseIndex(exercises)).toBe(1);
  });

  it('is -1 once every set of every exercise is done', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', sets: [done()] },
      { exerciseId: 'b', sets: [done()] },
    ];
    expect(activeExerciseIndex(exercises)).toBe(-1);
  });
});

describe('isCurrentSet', () => {
  const exercises: SessionExercise[] = [
    { exerciseId: 'a', sets: [done(), done()] },
    { exerciseId: 'b', sets: [done(), todo(), todo()] },
    { exerciseId: 'c', sets: [todo()] },
  ];

  it('marks exactly one set — the first incomplete set of the active exercise', () => {
    let count = 0;
    for (const [exIdx, ex] of exercises.entries()) {
      for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
        if (isCurrentSet(exercises, exIdx, setIdx)) count++;
      }
    }
    expect(count).toBe(1);
    expect(isCurrentSet(exercises, 1, 1)).toBe(true);
  });

  it('does not mark completed sets, later sets in the active exercise, or sets in later exercises', () => {
    expect(isCurrentSet(exercises, 1, 0)).toBe(false); // completed
    expect(isCurrentSet(exercises, 1, 2)).toBe(false); // future set in active exercise
    expect(isCurrentSet(exercises, 2, 0)).toBe(false); // later exercise
  });
});

describe('setRowView', () => {
  const noRest = { restAfter: null, restSecondsLeft: null };

  it('marks one current set; every other incomplete set is future, across exercises', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', sets: [done(), todo(), todo()] },
      { exerciseId: 'b', sets: [todo(), todo()] },
    ];
    const statuses = exercises.map((ex, exIdx) =>
      ex.sets.map((_, setIdx) => setRowView(exercises, exIdx, setIdx, noRest).status)
    );
    expect(statuses).toEqual([
      ['completed', 'current', 'future'],
      // the first set of a later exercise is muted too (was rendered as un-muted before)
      ['future', 'future'],
    ]);
  });

  it('labels warm-ups W1 and working sets 1, 2', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', sets: [todo({ isWarmUp: true }), todo(), todo()] },
    ];
    expect([0, 1, 2].map((i) => setRowView(exercises, 0, i, noRest).label)).toEqual(['W1', '1', '2']);
    expect(setRowView(exercises, 0, 0, noRest).isWarmUp).toBe(true);
  });

  it('shows a rest row after a working set by default (120 s) and not after a warm-up', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', sets: [todo({ isWarmUp: true }), todo()] },
    ];
    expect(setRowView(exercises, 0, 0, noRest)).toMatchObject({ restPresetSeconds: 0, showRestAfter: false });
    expect(setRowView(exercises, 0, 1, noRest)).toMatchObject({ restPresetSeconds: 120, showRestAfter: true });
  });

  it('uses the exercise rest presets; explicit 0 hides the work-set rest row', () => {
    const exercises: SessionExercise[] = [
      {
        exerciseId: 'a',
        restBetweenSetsSeconds: 0,
        warmUpRestSeconds: 45,
        sets: [todo({ isWarmUp: true }), todo()],
      },
    ];
    expect(setRowView(exercises, 0, 0, noRest)).toMatchObject({ restPresetSeconds: 45, showRestAfter: true });
    expect(setRowView(exercises, 0, 1, noRest)).toMatchObject({ restPresetSeconds: 0, showRestAfter: false });
  });

  it('a running countdown shows its rest row even when the preset is 0', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', restBetweenSetsSeconds: 0, sets: [done(), todo()] },
    ];
    const rest = { restAfter: { exIdx: 0, setIdx: 0 }, restSecondsLeft: 30 };
    expect(setRowView(exercises, 0, 0, rest)).toMatchObject({ restActive: true, showRestAfter: true });
    expect(setRowView(exercises, 0, 1, rest).restActive).toBe(false);
    expect(setRowView(exercises, 0, 0, { ...rest, restSecondsLeft: 0 }).restActive).toBe(false);
  });

  it('joins the green column only between two completed sets with no countdown', () => {
    const exercises: SessionExercise[] = [{ exerciseId: 'a', sets: [done(), done(), todo()] }];
    expect(setRowView(exercises, 0, 0, noRest).restJoinsCompleted).toBe(true);
    expect(setRowView(exercises, 0, 1, noRest).restJoinsCompleted).toBe(false);
    const counting = { restAfter: { exIdx: 0, setIdx: 0 }, restSecondsLeft: 10 };
    expect(setRowView(exercises, 0, 0, counting).restJoinsCompleted).toBe(false);
  });

  it('shows the rest actually taken once a completed set has one recorded, else the preset', () => {
    const exercises: SessionExercise[] = [{ exerciseId: 'a', sets: [done(), todo(), todo()] }];
    expect(setRowView(exercises, 0, 0, { ...noRest, recordedRestSeconds: 107 })).toMatchObject({
      restShownSeconds: 107,
      restIsRecorded: true,
    });
    expect(setRowView(exercises, 0, 0, noRest)).toMatchObject({ restShownSeconds: 120, restIsRecorded: false });
    // un-completed: a kept recording stays hidden until the set is completed again
    expect(setRowView(exercises, 0, 1, { ...noRest, recordedRestSeconds: 90 })).toMatchObject({
      restShownSeconds: 120,
      restIsRecorded: false,
    });
  });

  it('a recorded rest keeps its row even when the preset is now 0', () => {
    const exercises: SessionExercise[] = [
      { exerciseId: 'a', restBetweenSetsSeconds: 0, sets: [done(), todo()] },
    ];
    expect(setRowView(exercises, 0, 0, { ...noRest, recordedRestSeconds: 60 }).showRestAfter).toBe(true);
  });

  it('hides the rest row after the last set of a finished exercise unless it is counting down', () => {
    const exercises: SessionExercise[] = [{ exerciseId: 'a', sets: [done(), done()] }];
    expect(setRowView(exercises, 0, 1, { ...noRest, recordedRestSeconds: 120 }).showRestAfter).toBe(false);
    const counting = { restAfter: { exIdx: 0, setIdx: 1 }, restSecondsLeft: 10 };
    expect(setRowView(exercises, 0, 1, counting).showRestAfter).toBe(true);
    // an unfinished exercise keeps the row after its last set, above Add set
    const open: SessionExercise[] = [{ exerciseId: 'a', sets: [done(), todo()] }];
    expect(setRowView(open, 0, 1, noRest).showRestAfter).toBe(true);
  });
});

describe('headerRestState', () => {
  it('flags a set rest without digits, shows a manual rest, idles otherwise', () => {
    expect(headerRestState({ exIdx: 0, setIdx: 1 }, 90)).toBe('set');
    expect(headerRestState(null, 90)).toBe('manual');
    expect(headerRestState(null, null)).toBe('idle');
    expect(headerRestState({ exIdx: 0, setIdx: 1 }, 0)).toBe('idle');
  });
});

describe('previousLabel', () => {
  it('formats the snapshot in the user unit, or —', () => {
    expect(previousLabel({ weightKg: 60, reps: 5 }, 'kg')).toBe('60 × 5');
    expect(previousLabel({ weightKg: 56.25, reps: 8 }, 'kg')).toBe('56.25 × 8');
    expect(previousLabel({ weightKg: 100, reps: 5 }, 'lb')).toBe('220.5 × 5');
    expect(previousLabel({ weightKg: 60 }, 'kg')).toBe('60 kg');
    expect(previousLabel(undefined, 'kg')).toBe('—');
  });
});
