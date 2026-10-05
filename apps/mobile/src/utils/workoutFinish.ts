/**
 * Pure decision logic for the finish-workout summary.
 *
 * The active-workout screen offers a different set of save options depending on what the
 * session was started from (empty / built-in / custom) and whether the template was
 * changed during the workout — exercise list *or* per-exercise working/warm-up set counts.
 * Built-in templates are immutable, so the only way to keep a modified built-in is to save
 * it as a *new* custom template. See docs/features/workout-logging.md#finish-flow and
 * docs/features/templates.md#built-in-vs-custom.
 *
 * This module is the single source of truth for that matrix so it can be unit-tested against
 * the spec; the screen renders from it rather than re-deriving the branches inline.
 */
import type { SetRecord, WorkoutSession } from '@muscleos/types';
import { formatClockMs } from '@/utils/formatClock';
import { kgToDisplay, type WeightUnit } from '@/utils/weightUnits';

/** Where the finished workout was started from, combined with whether its template was edited. */
export type FinishFlowVariant = 'empty' | 'builtin-changed' | 'custom-changed' | 'unchanged';

export interface FinishFlowInput {
  /** Started from the empty / ad-hoc workout (`templateId === '_empty'`). */
  isEmpty: boolean;
  /** The originating template is a built-in program. */
  isBuiltIn: boolean;
  /**
   * The session no longer matches the template it started from: exercise list (identity/order)
   * or per-exercise working/warm-up row counts.
   */
  listChanged: boolean;
}

export type FinishActionId = 'save_as_template' | 'overwrite' | 'save_values' | 'discard';

export interface FinishOption {
  id: FinishActionId;
  label: string;
}

export type TemplatePlanSlot = {
  exerciseId: string;
  sets: number;
  warmUpSets: number;
};

/**
 * The exercise list is "changed" when it no longer matches the template it started from,
 * either in length or in order. An `_empty` / ad-hoc workout has no template to compare against,
 * so it is never considered a change here (handled by {@link finishFlowVariant} instead).
 */
export function templateListChanged(
  sessionExerciseIds: readonly string[],
  templateExerciseIds: readonly string[]
): boolean {
  if (sessionExerciseIds.length !== templateExerciseIds.length) return true;
  return sessionExerciseIds.some((id, i) => templateExerciseIds[i] !== id);
}

/**
 * True when the session's exercise identity/order *or* working/warm-up row counts differ from
 * the template plan it started from. Incomplete rows still count — this is structure, not
 * which sets were logged.
 */
export function templateStructureChanged(
  sessionPlan: readonly TemplatePlanSlot[],
  templatePlan: readonly TemplatePlanSlot[]
): boolean {
  if (sessionPlan.length !== templatePlan.length) return true;
  return sessionPlan.some((ex, i) => {
    const planned = templatePlan[i];
    return (
      ex.exerciseId !== planned.exerciseId ||
      ex.sets !== planned.sets ||
      ex.warmUpSets !== planned.warmUpSets
    );
  });
}

/** Classify the finish flow into one of four mutually exclusive variants. */
export function finishFlowVariant({ isEmpty, isBuiltIn, listChanged }: FinishFlowInput): FinishFlowVariant {
  if (isEmpty) return 'empty';
  if (listChanged) return isBuiltIn ? 'builtin-changed' : 'custom-changed';
  return 'unchanged';
}

/**
 * The ordered save options shown in the finish summary for a given variant.
 *
 * - **empty**: Save as template · Save values only · Discard
 * - **builtin-changed**: Save as new template · Save values only · Discard
 * - **custom-changed**: Save values only · Overwrite this template · Save as new template · Discard
 * - **unchanged**: Save values · Discard
 *
 * A built-in template can never be overwritten — its only "changed" option is to fork it into a
 * new custom template.
 */
export function finishSaveOptions(input: FinishFlowInput): FinishOption[] {
  const discard: FinishOption = { id: 'discard', label: 'Discard workout' };
  switch (finishFlowVariant(input)) {
    case 'empty':
      return [
        { id: 'save_as_template', label: 'Save as template' },
        { id: 'save_values', label: 'Save values only' },
        discard,
      ];
    case 'builtin-changed':
      return [
        { id: 'save_as_template', label: 'Save as new template' },
        { id: 'save_values', label: 'Save values only' },
        discard,
      ];
    case 'custom-changed':
      return [
        { id: 'save_values', label: 'Save values only' },
        { id: 'overwrite', label: 'Overwrite this template' },
        { id: 'save_as_template', label: 'Save as new template' },
        discard,
      ];
    default:
      return [
        { id: 'save_values', label: 'Save values' },
        discard,
      ];
  }
}

/** Number of completed sets across the whole session. */
export function completedSetCount(session: Pick<WorkoutSession, 'exercises'>): number {
  return session.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.completed).length, 0);
}

/**
 * The fact line on the **Cancel workout?** dialog: elapsed time and completed-set count
 * (`"12:05 · 3 sets"`), or undefined — no line — while nothing is completed.
 */
export function cancelDialogMeta(
  session: Pick<WorkoutSession, 'exercises'>,
  elapsedMs: number
): string | undefined {
  const n = completedSetCount(session);
  if (n === 0) return undefined;
  return `${formatClockMs(elapsedMs)} · ${n} set${n === 1 ? '' : 's'}`;
}

export interface FinishSummaryExercise {
  name: string;
  /** Completed set count (always > 0 — exercises with none are left out). */
  completed: number;
  sets: SetRecord[];
}

export interface FinishSummary {
  /** Template name; "Empty workout" for an ad-hoc session; "Workout" when the template is gone. */
  name: string;
  durationMs: number;
  /** Only exercises with at least one completed set, in session order. */
  exercises: FinishSummaryExercise[];
  /** Completed sets across those exercises (the Good-work "Sets" stat). */
  totalSets: number;
}

/**
 * The summary shown in the finish modal and on the "Good work" screen. Incomplete sets — and
 * exercises with nothing completed — are left out, though they are still saved with the session.
 */
export function buildFinishSummary(
  session: Pick<WorkoutSession, 'templateId' | 'exercises'>,
  templateName: string | undefined,
  nameOf: (exerciseId: string) => string,
  durationMs: number
): FinishSummary {
  const exercises = session.exercises
    .map((se) => {
      const sets = se.sets.filter((s) => s.completed);
      return { name: nameOf(se.exerciseId), completed: sets.length, sets };
    })
    .filter((ex) => ex.completed > 0);
  return {
    name: templateName ?? (session.templateId === '_empty' ? 'Empty workout' : 'Workout'),
    durationMs,
    exercises,
    totalSets: exercises.reduce((n, ex) => n + ex.completed, 0),
  };
}

/**
 * One completed set in a summary line: `"60 kg × 5 reps"` (unit only when `withUnit`), just the
 * weight or reps when the other is missing, or `—`. A zero weight is treated as missing.
 */
export function formatSummarySet(
  set: Pick<SetRecord, 'weightKg' | 'reps'>,
  unit: WeightUnit,
  withUnit: boolean
): string {
  const w =
    set.weightKg != null && set.weightKg > 0
      ? `${kgToDisplay(set.weightKg, unit)}${withUnit ? ` ${unit}` : ''}`
      : '';
  const r = set.reps != null ? `${set.reps} reps` : '';
  return w && r ? `${w} × ${r}` : w || r || '—';
}

/** Whether any of these sets has a weight or reps worth listing. */
export function hasSetDetail(sets: readonly Pick<SetRecord, 'weightKg' | 'reps'>[]): boolean {
  return sets.some((s) => s.weightKg != null || s.reps != null);
}
