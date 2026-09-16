import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetRecord } from '@muscleos/types';
import {
  activeExerciseIndex,
  firstIncompleteSetIndex,
  isCurrentSet,
  setLabel,
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
