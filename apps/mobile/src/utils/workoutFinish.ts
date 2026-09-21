/**
 * Pure decision logic for the finish-workout summary.
 *
 * The active-workout screen offers a different set of save options depending on what the
 * session was started from (empty / built-in / custom) and whether the template was
 * changed during the workout — exercise list *or* per-exercise working/warm-up set counts.
 * Built-in templates are immutable, so the only way to keep a modified built-in is to save
 * it as a *new* custom template (Pro). See docs/features/workout-logging.md#finish-flow and
 * docs/features/templates.md#built-in-vs-custom.
 *
 * This module is the single source of truth for that matrix so it can be unit-tested against
 * the spec; the screen renders from it rather than re-deriving the branches inline.
 */

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
  /** Requires an active Pro subscription; tapping on Basic opens the paywall. */
  requiresPro: boolean;
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
 * - **empty**: Save as template (Pro) · Save values only · Discard
 * - **builtin-changed**: Save as new template (Pro) · Save values only · Discard
 * - **custom-changed**: Save values only · Overwrite this template (Pro) · Save as new template (Pro) · Discard
 * - **unchanged**: Save values · Discard
 *
 * A built-in template can never be overwritten — its only "changed" option is to fork it into a
 * new custom template.
 */
export function finishSaveOptions(input: FinishFlowInput): FinishOption[] {
  const discard: FinishOption = { id: 'discard', label: 'Discard workout', requiresPro: false };
  switch (finishFlowVariant(input)) {
    case 'empty':
      return [
        { id: 'save_as_template', label: 'Save as template', requiresPro: true },
        { id: 'save_values', label: 'Save values only', requiresPro: false },
        discard,
      ];
    case 'builtin-changed':
      return [
        { id: 'save_as_template', label: 'Save as new template', requiresPro: true },
        { id: 'save_values', label: 'Save values only', requiresPro: false },
        discard,
      ];
    case 'custom-changed':
      return [
        { id: 'save_values', label: 'Save values only', requiresPro: false },
        { id: 'overwrite', label: 'Overwrite this template', requiresPro: true },
        { id: 'save_as_template', label: 'Save as new template', requiresPro: true },
        discard,
      ];
    default:
      return [
        { id: 'save_values', label: 'Save values', requiresPro: false },
        discard,
      ];
  }
}
