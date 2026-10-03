import { describe, expect, it } from 'vitest';
import type { SetRecord } from '@muscleos/types';
import {
  applyKeypadKey,
  applyRestTimeKey,
  focusRestTimeBox,
  keypadDisplayValue,
  keypadStep,
  type RestTimeEntry,
} from './keypadInput';

/** Key handling for the set pad and the rest-time pad (docs/features/workout-logging.md#entering-values). */

const set = (over: Partial<SetRecord> = {}): SetRecord => ({ completed: false, ...over });
const digit = (d: string) => ({ kind: 'digit' as const, digit: d });

describe('applyKeypadKey — digits', () => {
  it('appends to a typed value', () => {
    expect(applyKeypadKey(set({ reps: 1 }), 'reps', digit('2'), 'kg').patch).toEqual({
      reps: 12,
      repsPrefilled: false,
    });
  });

  it('first digit overwrites a prefilled suggestion instead of appending', () => {
    const s = set({ weightKg: 60, weightPrefilled: true, reps: 5, repsPrefilled: true });
    expect(applyKeypadKey(s, 'weight', digit('7'), 'kg').patch).toEqual({
      weightKg: 7,
      weightPrefilled: false,
    });
    expect(applyKeypadKey(s, 'reps', digit('8'), 'kg').patch).toEqual({ reps: 8, repsPrefilled: false });
  });

  it('caps digits at 4 for weight and 3 for reps', () => {
    expect(applyKeypadKey(set({ weightKg: 1000 }), 'weight', digit('5'), 'kg').patch?.weightKg).toBe(1000);
    expect(applyKeypadKey(set({ reps: 100 }), 'reps', digit('5'), 'kg').patch?.reps).toBe(100);
  });

  it('converts pounds to kg on write (2dp)', () => {
    // Empty cell, user types 5 (lb) → stored as 2.27 kg
    expect(applyKeypadKey(set(), 'weight', digit('5'), 'lb').patch?.weightKg).toBe(2.27);
    // 6.12 kg shows as 13.5 lb — a plate fraction, so a digit replaces it rather than extending it
    expect(applyKeypadKey(set({ weightKg: 6.12 }), 'weight', digit('1'), 'lb').patch?.weightKg).toBe(0.45);
    // 13.61 kg shows as 30 lb; typing 5 gives 305 lb
    expect(applyKeypadKey(set({ weightKg: 13.61 }), 'weight', digit('5'), 'lb').patch?.weightKg).toBe(138.35);
  });
});

describe('applyKeypadKey — backspace and ±', () => {
  it('backspace edits the shown value and clears the prefill flag', () => {
    const s = set({ weightKg: 60, weightPrefilled: true });
    expect(applyKeypadKey(s, 'weight', { kind: 'backspace' }, 'kg').patch).toEqual({
      weightKg: 6,
      weightPrefilled: false,
    });
  });

  it('backspace to empty clears the field', () => {
    expect(applyKeypadKey(set({ reps: 5 }), 'reps', { kind: 'backspace' }, 'kg').patch).toEqual({
      reps: undefined,
      repsPrefilled: false,
    });
  });

  it('± steps a plate for weight (0.25 kg / 2.5 lb) and 1 for reps', () => {
    expect(keypadStep('weight', 'kg')).toBe(0.25);
    expect(keypadStep('weight', 'lb')).toBe(2.5);
    expect(keypadStep('reps', 'lb')).toBe(1);
    expect(applyKeypadKey(set({ weightKg: 60 }), 'weight', { kind: 'adjust', direction: 1 }, 'kg').patch)
      .toEqual({ weightKg: 60.25, weightPrefilled: false });
    expect(applyKeypadKey(set({ reps: 5 }), 'reps', { kind: 'adjust', direction: -1 }, 'kg').patch).toEqual({
      reps: 4,
      repsPrefilled: false,
    });
  });

  it('− clamps to empty at zero', () => {
    expect(applyKeypadKey(set({ reps: 1 }), 'reps', { kind: 'adjust', direction: -1 }, 'kg').patch?.reps)
      .toBeUndefined();
  });
});

describe('applyKeypadKey — Next / Done', () => {
  it('Next on weight jumps to the same set’s reps; does nothing on reps', () => {
    expect(applyKeypadKey(set(), 'weight', { kind: 'next' }, 'kg')).toEqual({ focus: 'reps' });
    expect(applyKeypadKey(set(), 'reps', { kind: 'next' }, 'kg')).toEqual({});
  });

  it('Done is disabled until reps > 0', () => {
    expect(applyKeypadKey(set({ weightKg: 60 }), 'reps', { kind: 'done' }, 'kg')).toEqual({});
    expect(applyKeypadKey(set({ reps: 0 }), 'reps', { kind: 'done' }, 'kg')).toEqual({});
  });

  it('Done completes the set (starting its rest) and hides the pad', () => {
    expect(applyKeypadKey(set({ reps: 5 }), 'reps', { kind: 'done' }, 'kg')).toEqual({
      complete: true,
      focus: null,
    });
  });

  it('Done on an already-completed set only hides the pad', () => {
    expect(applyKeypadKey(set({ reps: 5, completed: true }), 'reps', { kind: 'done' }, 'kg')).toEqual({
      focus: null,
    });
  });

  it('Done is not a weight-field action', () => {
    expect(applyKeypadKey(set({ reps: 5 }), 'weight', { kind: 'done' }, 'kg')).toEqual({});
  });
});

describe('keypadDisplayValue', () => {
  it('shows weight in the user unit and reps as-is', () => {
    expect(keypadDisplayValue({ weightKg: 100 }, 'weight', 'lb')).toBe(220.5);
    expect(keypadDisplayValue({ weightKg: 100 }, 'weight', 'kg')).toBe(100);
    expect(keypadDisplayValue({ reps: 8 }, 'reps', 'kg')).toBe(8);
    expect(keypadDisplayValue({}, 'weight', 'kg')).toBeUndefined();
  });
});

describe('applyRestTimeKey (time mode)', () => {
  const base: RestTimeEntry = { work: 120, warmUp: 0, field: null, replace: true };

  it('first digit after focusing replaces the time, later digits shift in from the right', () => {
    let e = focusRestTimeBox(base, 'work');
    e = applyRestTimeKey(e, digit('1'));
    expect(e.work).toBe(1); // 0:01
    e = applyRestTimeKey(e, digit('3'));
    expect(e.work).toBe(13); // 0:13
    e = applyRestTimeKey(e, digit('0'));
    expect(e.work).toBe(90); // 1:30
  });

  it('ignores a digit that makes seconds > 59 or the total past 15:00', () => {
    let e = applyRestTimeKey(focusRestTimeBox(base, 'work'), digit('7'));
    e = applyRestTimeKey(e, digit('5')); // "75" → 0:75 invalid
    expect(e.work).toBe(7);
    let f = { ...focusRestTimeBox(base, 'work'), work: 15 * 60, replace: false };
    f = applyRestTimeKey(f, digit('1'));
    expect(f.work).toBe(15 * 60);
  });

  it('allows 0:00 — backspace right after focusing clears the box', () => {
    const e = applyRestTimeKey(focusRestTimeBox(base, 'work'), { kind: 'backspace' });
    expect(e.work).toBe(0);
  });

  it('backspace drops the last digit', () => {
    const e = applyRestTimeKey({ ...base, field: 'work', replace: false, work: 90 }, { kind: 'backspace' });
    expect(e.work).toBe(13); // "130" → "13" → 0:13
  });

  it('Next moves Work set → Warm up (replace armed); Done hides the pad', () => {
    const next = applyRestTimeKey({ ...base, field: 'work', replace: false }, { kind: 'next' });
    expect(next.field).toBe('warmUp');
    expect(next.replace).toBe(true);
    expect(applyRestTimeKey(next, { kind: 'done' }).field).toBeNull();
  });

  it('edits only the focused box and is inert when no box is focused', () => {
    const e = applyRestTimeKey(focusRestTimeBox(base, 'warmUp'), digit('3'));
    expect(e).toMatchObject({ work: 120, warmUp: 3 });
    expect(applyRestTimeKey(base, digit('3'))).toBe(base);
  });
});
