import type { SetRecord } from '@muscleos/types';
import { canCompleteSet } from '@/store/activeWorkoutLogic';
import { displayToKg, kgToDisplay, type WeightUnit } from '@/utils/weightUnits';

/**
 * Pure numeric-entry logic for the in-app set keypad (`NumericKeypad`).
 *
 * These operate on the *display* value a cell shows (weight in the user's unit, or reps) —
 * never on stored kg. The screen converts to/from kg at the edge. Keeping the maths here
 * means it stays testable without a keyboard or a render tree.
 *
 * Digits are whole numbers only. The −/+ keys are the only way to land on a plate fraction
 * (2.5 lb or 0.25 kg).
 */

/** Max digits typed into each field, so a fat-fingered hold can't overflow the row. */
export const WEIGHT_MAX_DIGITS = 4;
export const REPS_MAX_DIGITS = 3;

/** Plate-style ± steps for the keypad's minus/plus keys. */
export const WEIGHT_STEP_KG = 0.25;
export const WEIGHT_STEP_LB = 2.5;
export const REPS_STEP = 1;

/** Longest rest that can be typed, matching the workout rest ceiling (15:00). */
export const REST_TIME_MAX_SECONDS = 15 * 60;
/** Digits in an MMSS entry. */
export const REST_TIME_MAX_DIGITS = 4;

/** Digit buffer for a stored rest, without leading zeros. 2:00 → "200", 0:00 → "". */
export function restTimeDigits(seconds: number): string {
  const whole = Math.min(REST_TIME_MAX_SECONDS, Math.max(0, Math.trunc(seconds) || 0));
  const mm = Math.floor(whole / 60);
  const ss = whole % 60;
  return `${mm}${ss.toString().padStart(2, '0')}`.replace(/^0+/, '');
}

/** MMSS digits → seconds. Invalid seconds (over 59) or anything past 15:00 returns null. */
export function restSecondsFromDigits(digits: string): number | null {
  if (digits === '') return 0;
  if (!/^[0-9]{1,4}$/.test(digits)) return null;
  const padded = digits.padStart(4, '0');
  const mm = parseInt(padded.slice(0, 2), 10);
  const ss = parseInt(padded.slice(2, 4), 10);
  if (ss > 59) return null;
  const total = mm * 60 + ss;
  if (total > REST_TIME_MAX_SECONDS) return null;
  return total;
}

/**
 * Clock-style entry: digits shift into MMSS from the right.
 * The first digit of a focused field replaces the current time (`replace`).
 * A digit that would make seconds > 59 or the total past 15:00 is ignored.
 */
export function appendRestTimeDigit(digits: string, digit: string, replace: boolean): string | null {
  if (!/^[0-9]$/.test(digit)) return null;
  const base = replace ? '' : digits;
  if (base.length >= REST_TIME_MAX_DIGITS) return null;
  const next = base + digit;
  if (restSecondsFromDigits(next) == null) return null;
  return next;
}

/** Drop the last typed digit. Empty means 0:00. */
export function backspaceRestTime(digits: string): string {
  return digits.slice(0, -1);
}

/** Integer portion of a value as a bare digit string (no sign, no decimals). */
function integerDigits(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(Math.trunc(Math.abs(value)));
}

function hasPlateFraction(value: number | undefined): value is number {
  return value != null && !Number.isNaN(value) && !Number.isInteger(value);
}

/**
 * Append a typed digit. Entry is a whole number: a decimal key is ignored, and a plate
 * fraction (from −/+) is replaced by the new integer instead of being extended.
 * A leading zero is replaced (typing `5` into `0` gives `5`), and the value can't grow
 * past `maxDigits`. Returns the new numeric value.
 */
export function keypadAppendDigit(
  current: number | undefined,
  digit: string,
  maxDigits: number
): number | undefined {
  if (!/^[0-9]$/.test(digit)) return current;
  const base = hasPlateFraction(current) ? '' : integerDigits(current);
  if (base.length >= maxDigits) return current;
  const nextStr = (base === '0' ? '' : base) + digit;
  const next = parseInt(nextStr, 10);
  return Number.isNaN(next) ? current : next;
}

/**
 * Drop the last typed digit. A plate fraction is not a typed digit, so the first
 * backspace snaps to the whole number (97.5 → 97, 0.25 → empty). Emptying the field
 * returns `undefined`.
 */
export function keypadBackspace(current: number | undefined): number | undefined {
  if (hasPlateFraction(current)) {
    const whole = Math.trunc(current);
    return whole > 0 ? whole : undefined;
  }
  const base = integerDigits(current);
  if (base === '') return undefined;
  const next = base.slice(0, -1);
  if (next === '') return undefined;
  const n = parseInt(next, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Nudge the value by `delta` (plate step or ±1 rep). Clamps at zero — a value that would
 * land at or below zero clears the field, so minus on an empty cell is a no-op.
 */
export function keypadAdjust(
  current: number | undefined,
  delta: number
): number | undefined {
  const base = current == null || Number.isNaN(current) ? 0 : current;
  const next = Math.round((base + delta) * 100) / 100;
  if (next <= 0) return undefined;
  return next;
}

// ── Key handling ─────────────────────────────────────────────────────────────────────────────
// What each key does to the focused set cell / rest-time box. The screen applies the outcome to
// the store; keeping the rules here makes the pad's behaviour testable without a renderer.

export type KeypadField = 'weight' | 'reps';

export type KeypadKey =
  | { kind: 'digit'; digit: string }
  | { kind: 'backspace' }
  | { kind: 'adjust'; direction: 1 | -1 }
  | { kind: 'next' }
  | { kind: 'done' };

export interface KeypadOutcome {
  /** Write this onto the focused set (weight always in kg). */
  patch?: Partial<SetRecord>;
  /** Move focus to this field of the same set; `null` hides the pad; omitted keeps focus. */
  focus?: KeypadField | null;
  /** Complete the set (which starts its rest). */
  complete?: boolean;
}

/** The value a set cell shows on the pad: weight in the user's unit, or reps. */
export function keypadDisplayValue(
  set: Pick<SetRecord, 'weightKg' | 'reps'>,
  field: KeypadField,
  unit: WeightUnit
): number | undefined {
  if (field === 'reps') return set.reps;
  return set.weightKg != null ? kgToDisplay(set.weightKg, unit) : undefined;
}

/** The pad's ± step for a field: a plate (0.25 kg / 2.5 lb) for weight, 1 for reps. */
export function keypadStep(field: KeypadField, unit: WeightUnit): number {
  if (field === 'reps') return REPS_STEP;
  return unit === 'lb' ? WEIGHT_STEP_LB : WEIGHT_STEP_KG;
}

/** Whether the focused field still holds an auto-loaded suggestion the user hasn't touched. */
export function keypadFieldIsPrefill(set: SetRecord, field: KeypadField): boolean {
  return field === 'weight' ? set.weightPrefilled === true : set.repsPrefilled === true;
}

function writeField(field: KeypadField, value: number | undefined, unit: WeightUnit): Partial<SetRecord> {
  // Any edit confirms the field, clearing its suggestion flag so later keystrokes append.
  if (field === 'reps') return { reps: value, repsPrefilled: false };
  return {
    weightKg: value == null ? undefined : displayToKg(value, unit),
    weightPrefilled: false,
  };
}

/**
 * One key press on the set pad.
 *
 * - **Digit**: appends (whole numbers, capped at 4 weight / 3 reps digits). A prefilled
 *   suggestion is treated as selected — the first digit replaces it.
 * - **Backspace / ±**: edit the value as shown. Any edit clears the field's prefill flag.
 * - Weight is converted from the display unit to kg on write.
 * - **Next** (weight only) moves to the same set's reps.
 * - **Done** (reps only) is disabled until reps > 0; it completes an incomplete set (starting its
 *   rest) and hides the pad. On an already-completed set it only hides the pad.
 */
export function applyKeypadKey(
  set: SetRecord,
  field: KeypadField,
  key: KeypadKey,
  unit: WeightUnit
): KeypadOutcome {
  const current = keypadDisplayValue(set, field, unit);
  switch (key.kind) {
    case 'digit': {
      const maxDigits = field === 'weight' ? WEIGHT_MAX_DIGITS : REPS_MAX_DIGITS;
      const base = keypadFieldIsPrefill(set, field) ? undefined : current;
      return { patch: writeField(field, keypadAppendDigit(base, key.digit, maxDigits), unit) };
    }
    case 'backspace':
      return { patch: writeField(field, keypadBackspace(current), unit) };
    case 'adjust':
      return {
        patch: writeField(field, keypadAdjust(current, key.direction * keypadStep(field, unit)), unit),
      };
    case 'next':
      return field === 'weight' ? { focus: 'reps' } : {};
    case 'done':
      if (field !== 'reps' || !canCompleteSet(set)) return {};
      return set.completed ? { focus: null } : { complete: true, focus: null };
  }
}

/** Editing state of the **Update rest timers** dialogue's two time boxes. */
export interface RestTimeEntry {
  work: number;
  warmUp: number;
  /** The box taking keypad input, or null when the pad is hidden. */
  field: 'work' | 'warmUp' | null;
  /** The next digit replaces the box's value (true right after a box is focused). */
  replace: boolean;
}

export type RestTimeKey =
  | { kind: 'digit'; digit: string }
  | { kind: 'backspace' }
  | { kind: 'next' }
  | { kind: 'done' };

/** Focus a time box: its first digit will replace the current time. */
export function focusRestTimeBox(entry: RestTimeEntry, field: 'work' | 'warmUp'): RestTimeEntry {
  return { ...entry, field, replace: true };
}

/**
 * One key press on the time pad (digits, backspace, Next, Done — no ±). Digits shift into `m:ss`
 * from the right and the first digit after focusing replaces the time; an invalid result
 * (seconds > 59, past 15:00) is ignored. Backspace right after focusing clears to 0:00.
 * **Next** moves from Work set to Warm up (and back); **Done** hides the pad.
 */
export function applyRestTimeKey(entry: RestTimeEntry, key: RestTimeKey): RestTimeEntry {
  const { field } = entry;
  if (field == null) return entry;
  if (key.kind === 'next') return focusRestTimeBox(entry, field === 'work' ? 'warmUp' : 'work');
  if (key.kind === 'done') return { ...entry, field: null };
  const current = entry[field];
  const nextDigits =
    key.kind === 'digit'
      ? appendRestTimeDigit(restTimeDigits(current), key.digit, entry.replace)
      : backspaceRestTime(entry.replace ? '' : restTimeDigits(current));
  if (nextDigits == null) return entry;
  const seconds = restSecondsFromDigits(nextDigits);
  if (seconds == null) return entry;
  return { ...entry, [field]: seconds, replace: false };
}
