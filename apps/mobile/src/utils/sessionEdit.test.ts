import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@muscleos/types';
import {
  addDraftExercise,
  addDraftSet,
  applySessionEdit,
  removeDraftExercise,
  replaceDraftExercise,
  draftChanged,
  draftProblem,
  removeDraftSet,
  sessionEditDraft,
  updateDraftSet,
} from './sessionEdit';

const original: WorkoutSession = {
  id: 'legs',
  templateId: 'ppl-legs',
  startedAt: '2026-10-22T16:00:00.000Z',
  completedAt: '2026-10-22T16:52:00.000Z',
  exercises: [
    {
      exerciseId: 'squat',
      sets: [
        { completed: true, reps: 8, weightKg: 60, isWarmUp: true },
        { completed: true, reps: 5, weightKg: 1000 },
        { completed: false, reps: 5, weightKg: 100 },
      ],
    },
    { exerciseId: 'leg-curl', sets: [{ completed: false }] },
    { exerciseId: 'romanian-deadlift', sets: [{ completed: true, reps: 8, weightKg: 80 }] },
  ],
};
const other: WorkoutSession = { ...original, id: 'push' };

describe('sessionEditDraft', () => {
  it('keeps completed sets only, and only exercises that have one', () => {
    const draft = sessionEditDraft(original);
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['squat', 'romanian-deadlift']);
    expect(draft.exercises[0].sets).toEqual([original.exercises[0].sets[0], original.exercises[0].sets[1]]);
    expect(draftChanged(original, draft)).toBe(false);
  });
});

describe('updateDraftSet / removeDraftSet', () => {
  it('writes a patch without suggestion flags', () => {
    const draft = updateDraftSet(sessionEditDraft(original), 0, 1, { weightKg: 100, weightPrefilled: false });
    expect(draft.exercises[0].sets[1]).toEqual({ completed: true, reps: 5, weightKg: 100 });
    expect(draftChanged(original, draft)).toBe(true);
  });

  it('removes a set, and the exercise with its last set', () => {
    let draft = removeDraftSet(sessionEditDraft(original), 0, 1);
    expect(draft.exercises[0].sets).toHaveLength(1);
    draft = removeDraftSet(draft, 1, 0);
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['squat']);
  });

  it('ignores an index that does not exist', () => {
    const draft = sessionEditDraft(original);
    expect(updateDraftSet(draft, 5, 0, { reps: 1 })).toBe(draft);
    expect(removeDraftSet(draft, 0, 9)).toBe(draft);
  });
});

describe('exercises and added sets', () => {
  it('adds a completed set copying the last one', () => {
    const draft = addDraftSet(sessionEditDraft(original), 1);
    expect(draft.exercises[1].sets).toEqual([
      { completed: true, reps: 8, weightKg: 80 },
      { completed: true, reps: 8, weightKg: 80 },
    ]);
  });

  it('adds an exercise with one empty set, never a duplicate', () => {
    const draft = addDraftExercise(sessionEditDraft(original), 'deadlift');
    expect(draft.exercises.at(-1)).toEqual({ exerciseId: 'deadlift', sets: [{ completed: true }] });
    expect(draftProblem(draft)).toBe('missing-reps');
    expect(addDraftExercise(draft, 'squat')).toBe(draft);
  });

  it('replaces an exercise keeping its sets, never into a duplicate', () => {
    const draft = sessionEditDraft(original);
    const replaced = replaceDraftExercise(draft, 0, 'front-squat');
    expect(replaced.exercises[0]).toEqual({ ...draft.exercises[0], exerciseId: 'front-squat' });
    expect(replaceDraftExercise(draft, 0, 'romanian-deadlift')).toBe(draft);
  });

  it('removes an exercise', () => {
    const draft = removeDraftExercise(sessionEditDraft(original), 0);
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['romanian-deadlift']);
  });
});

describe('draftProblem', () => {
  it('needs at least one set, and reps on every set', () => {
    const draft = sessionEditDraft(original);
    expect(draftProblem(draft)).toBeNull();
    expect(draftProblem(updateDraftSet(draft, 0, 0, { reps: undefined }))).toBe('missing-reps');
    expect(draftProblem({ ...draft, exercises: [] })).toBe('empty');
  });

  it('allows a set with no weight (bodyweight)', () => {
    expect(draftProblem(updateDraftSet(sessionEditDraft(original), 0, 0, { weightKg: undefined }))).toBeNull();
  });
});

describe('applySessionEdit', () => {
  it('saves in place, keeping the original times and stamping editedAt', () => {
    const draft = updateDraftSet(sessionEditDraft(original), 0, 1, { weightKg: 100 });
    const result = applySessionEdit([other, original], { ...draft, completedAt: 'moved' }, '2026-10-23T09:00:00.000Z');
    expect(result?.sessions.map((s) => s.id)).toEqual(['push', 'legs']);
    expect(result?.saved).toEqual({ ...original, exercises: draft.exercises, editedAt: '2026-10-23T09:00:00.000Z' });
    expect(result?.sessions[1]).toBe(result?.saved);
  });

  it('saves nothing when the original is gone or the draft has a problem', () => {
    const draft = sessionEditDraft(original);
    expect(applySessionEdit([other], draft, '2026-10-23T09:00:00.000Z')).toBeNull();
    expect(applySessionEdit([original], { ...draft, exercises: [] }, '2026-10-23T09:00:00.000Z')).toBeNull();
  });
});
