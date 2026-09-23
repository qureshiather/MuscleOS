import { describe, expect, it } from 'vitest';
import {
  appendRestTimeDigit,
  backspaceRestTime,
  keypadAdjust,
  keypadAppendDigit,
  keypadBackspace,
  REPS_MAX_DIGITS,
  restSecondsFromDigits,
  restTimeDigits,
  WEIGHT_MAX_DIGITS,
} from './keypadInput';

describe('rest time entry', () => {
  it('shifts digits into a clock from the right', () => {
    let digits = '';
    digits = appendRestTimeDigit(digits, '1', true) ?? digits;
    expect(restSecondsFromDigits(digits)).toBe(1);
    digits = appendRestTimeDigit(digits, '3', false) ?? digits;
    expect(restSecondsFromDigits(digits)).toBe(13);
    digits = appendRestTimeDigit(digits, '0', false) ?? digits;
    expect(restSecondsFromDigits(digits)).toBe(90);
    expect(digits).toBe('130');
  });

  it('replaces the current time on the first digit', () => {
    const next = appendRestTimeDigit(restTimeDigits(120), '4', true);
    expect(next).toBe('4');
    expect(restSecondsFromDigits(next ?? '')).toBe(4);
  });

  it('rejects a seconds value over 59 and anything past 15:00', () => {
    expect(appendRestTimeDigit('9', '9', false)).toBeNull();
    expect(appendRestTimeDigit('1500', '1', false)).toBeNull();
    expect(appendRestTimeDigit('150', '1', false)).toBeNull();
  });

  it('backspaces down to an empty 0:00', () => {
    expect(backspaceRestTime('130')).toBe('13');
    expect(restSecondsFromDigits('')).toBe(0);
    expect(restTimeDigits(0)).toBe('');
    expect(restTimeDigits(120)).toBe('200');
  });
});

describe('keypadAppendDigit', () => {
  it('appends digits to build a number', () => {
    let v: number | undefined;
    v = keypadAppendDigit(v, '1', WEIGHT_MAX_DIGITS); // 1
    v = keypadAppendDigit(v, '8', WEIGHT_MAX_DIGITS); // 18
    v = keypadAppendDigit(v, '0', WEIGHT_MAX_DIGITS); // 180
    expect(v).toBe(180);
  });

  it('replaces a leading zero rather than prefixing it', () => {
    expect(keypadAppendDigit(0, '5', WEIGHT_MAX_DIGITS)).toBe(5);
  });

  it('caps entry at the max digit count', () => {
    expect(keypadAppendDigit(9999, '9', WEIGHT_MAX_DIGITS)).toBe(9999);
    expect(keypadAppendDigit(999, '9', REPS_MAX_DIGITS)).toBe(999);
  });

  it('ignores non-digit input', () => {
    expect(keypadAppendDigit(5, '.', WEIGHT_MAX_DIGITS)).toBe(5);
    expect(keypadAppendDigit(5, 'a', WEIGHT_MAX_DIGITS)).toBe(5);
  });

  it('types over the integer part of a decimal value', () => {
    // A ± step can leave 2.5 in a kg field; typing then continues as integer entry.
    expect(keypadAppendDigit(2.5, '0', WEIGHT_MAX_DIGITS)).toBe(20);
  });
});

describe('keypadBackspace', () => {
  it('removes the last digit', () => {
    expect(keypadBackspace(180)).toBe(18);
    expect(keypadBackspace(18)).toBe(1);
  });

  it('clears the field on the final digit', () => {
    expect(keypadBackspace(1)).toBeUndefined();
    expect(keypadBackspace(undefined)).toBeUndefined();
  });
});

describe('keypadAdjust', () => {
  it('adds plate steps without floating-point drift', () => {
    expect(keypadAdjust(60, 2.5)).toBe(62.5);
    expect(keypadAdjust(62.5, 2.5)).toBe(65);
  });

  it('treats an empty field as zero', () => {
    expect(keypadAdjust(undefined, 5)).toBe(5);
  });

  it('clears the field when a decrement lands at or below zero', () => {
    expect(keypadAdjust(5, -5)).toBeUndefined();
    expect(keypadAdjust(undefined, -5)).toBeUndefined();
  });
});
