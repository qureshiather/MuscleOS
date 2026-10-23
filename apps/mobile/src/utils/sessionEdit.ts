import type { SetRecord, WorkoutSession } from '@muscleos/types';

/**
 * Editing a finished session from History (docs/features/history-analytics.md#editing-a-session).
 * The edit screen works on a draft: the session's completed sets only, since those are all
 * History shows and every metric counts. Pure, so it's unit tested.
 */

function cleanSet({ weightPrefilled, repsPrefilled, ...set }: SetRecord): SetRecord {
  return set;
}

/** The editable copy of a session: completed sets only, and only exercises that have one. */
export function sessionEditDraft(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises
      .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.completed).map(cleanSet) }))
      .filter((ex) => ex.sets.length > 0),
  };
}

/** Writes a keypad patch onto one set. Suggestion flags never reach a finished session. */
export function updateDraftSet(
  draft: WorkoutSession,
  exIdx: number,
  setIdx: number,
  patch: Partial<SetRecord>
): WorkoutSession {
  const ex = draft.exercises[exIdx];
  if (!ex?.sets[setIdx]) return draft;
  const sets = ex.sets.map((s, i) => (i === setIdx ? cleanSet({ ...s, ...patch }) : s));
  const exercises = draft.exercises.map((e, i) => (i === exIdx ? { ...e, sets } : e));
  return { ...draft, exercises };
}

/** Deletes one set; an exercise left with no sets is dropped from the workout. */
export function removeDraftSet(draft: WorkoutSession, exIdx: number, setIdx: number): WorkoutSession {
  const ex = draft.exercises[exIdx];
  if (!ex?.sets[setIdx]) return draft;
  const sets = ex.sets.filter((_, i) => i !== setIdx);
  const exercises =
    sets.length > 0
      ? draft.exercises.map((e, i) => (i === exIdx ? { ...e, sets } : e))
      : draft.exercises.filter((_, i) => i !== exIdx);
  return { ...draft, exercises };
}

/** Appends a set copying the last one's weight and reps, as logging does. */
export function addDraftSet(draft: WorkoutSession, exIdx: number): WorkoutSession {
  const ex = draft.exercises[exIdx];
  if (!ex) return draft;
  const last = ex.sets.at(-1);
  const added: SetRecord = { completed: true, weightKg: last?.weightKg, reps: last?.reps };
  const exercises = draft.exercises.map((e, i) => (i === exIdx ? { ...e, sets: [...e.sets, added] } : e));
  return { ...draft, exercises };
}

/** Appends an exercise with one empty set. A no-op when it's already in the workout. */
export function addDraftExercise(draft: WorkoutSession, exerciseId: string): WorkoutSession {
  if (draft.exercises.some((e) => e.exerciseId === exerciseId)) return draft;
  return { ...draft, exercises: [...draft.exercises, { exerciseId, sets: [{ completed: true }] }] };
}

/**
 * Swaps the exercise at `exIdx`, keeping its sets: in an edit, a replace fixes which lift was
 * logged, not what was lifted. A no-op when the new exercise is already in the workout.
 */
export function replaceDraftExercise(draft: WorkoutSession, exIdx: number, exerciseId: string): WorkoutSession {
  if (!draft.exercises[exIdx] || draft.exercises.some((e) => e.exerciseId === exerciseId)) return draft;
  const exercises = draft.exercises.map((e, i) => (i === exIdx ? { ...e, exerciseId } : e));
  return { ...draft, exercises };
}

export function removeDraftExercise(draft: WorkoutSession, exIdx: number): WorkoutSession {
  if (!draft.exercises[exIdx]) return draft;
  return { ...draft, exercises: draft.exercises.filter((_, i) => i !== exIdx) };
}

export type DraftProblem = 'empty' | 'missing-reps';

/** Why the draft can't be saved, or null. Weight is optional (bodyweight); reps are not. */
export function draftProblem(draft: WorkoutSession): DraftProblem | null {
  if (draft.exercises.length === 0) return 'empty';
  if (draft.exercises.some((ex) => ex.sets.some((s) => s.reps == null || s.reps <= 0))) {
    return 'missing-reps';
  }
  return null;
}

export const DRAFT_PROBLEM_COPY: Record<DraftProblem, string> = {
  empty: 'A workout needs at least one set. To remove it, delete it from History.',
  'missing-reps': 'Every set needs reps.',
};

/** Whether the draft differs from the session it was made from. */
export function draftChanged(original: WorkoutSession, draft: WorkoutSession): boolean {
  return JSON.stringify(sessionEditDraft(original).exercises) !== JSON.stringify(draft.exercises);
}

/**
 * The stored list with the draft saved over its original, in place. The original's
 * `startedAt`/`completedAt` are kept (an edit never moves a workout in time) and `editedAt` is
 * stamped so sync treats it as the newer copy. Null when the original is gone (deleted on
 * another device) or the draft can't be saved.
 */
export function applySessionEdit(
  sessions: readonly WorkoutSession[],
  draft: WorkoutSession,
  editedAt: string
): { sessions: WorkoutSession[]; saved: WorkoutSession } | null {
  const index = sessions.findIndex((s) => s.id === draft.id);
  if (index < 0 || draftProblem(draft)) return null;
  const original = sessions[index];
  const saved: WorkoutSession = {
    ...original,
    exercises: draft.exercises,
    editedAt,
  };
  const next = [...sessions];
  next[index] = saved;
  return { sessions: next, saved };
}
