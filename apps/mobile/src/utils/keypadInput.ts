/**
 * Pure numeric-entry logic for the in-app set keypad (`NumericKeypad`).
 *
 * These operate on the *display* value a cell shows (integer weight in the user's unit,
 * or reps) — never on stored kg. The screen converts to/from kg at the edge. Keeping the
 * maths here means it stays testable without a keyboard or a render tree.
 */

/** Max digits typed into each field, so a fat-fingered hold can't overflow the row. */
export const WEIGHT_MAX_DIGITS = 4;
export const REPS_MAX_DIGITS = 3;

/** Plate-style ± steps for the keypad's minus/plus keys. */
export const WEIGHT_STEP_KG = 2.5;
export const WEIGHT_STEP_LB = 5;
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

/**
 * Append a typed digit to the current value, treating entry as integer.
 * A leading zero is replaced (typing `5` into `0` gives `5`), and the value can't grow
 * past `maxDigits`. Returns the new numeric value.
 */
export function keypadAppendDigit(
  current: number | undefined,
  digit: string,
  maxDigits: number
): number | undefined {
  if (!/^[0-9]$/.test(digit)) return current;
  const base = integerDigits(current);
  if (base.length >= maxDigits) return current;
  const nextStr = (base === '0' ? '' : base) + digit;
  const next = parseInt(nextStr, 10);
  return Number.isNaN(next) ? current : next;
}

/** Drop the last typed digit. Emptying the field returns `undefined`. */
export function keypadBackspace(current: number | undefined): number | undefined {
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
