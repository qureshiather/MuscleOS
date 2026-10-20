import { describe, expect, it } from 'vitest';
import {
  ageRangeHint,
  BIODATA_EMPTY_HINT,
  type BiodataUnits,
  biodataSummary,
  buildProfileFromInputs,
  validateBiodataInputs,
  weightRangeHint,
} from './biodata';

/** docs/features/accounts-and-data.md#profile — the Biodata editor and the Profile tab hint. */

const metric = { bodyWeightUnit: 'kg' as const };
const imperial = { bodyWeightUnit: 'lb' as const };
const inputs = (weight: string, age = '', sex: 'male' | 'female' | null = null) => ({ weight, age, sex });

describe('buildProfileFromInputs', () => {
  it('stores metric input as entered', () => {
    expect(buildProfileFromInputs(inputs('80.5', '30', 'male'), metric, {})).toEqual({
      weightKg: 80.5,
      age: 30,
      sex: 'male',
    });
  });

  it('converts pounds to kg', () => {
    expect(buildProfileFromInputs(inputs('176'), imperial, {})).toEqual({ weightKg: 79.83 });
  });

  it('a blank field clears it', () => {
    expect(buildProfileFromInputs(inputs('', ''), metric, { weightKg: 80, age: 30 })).toEqual({});
    expect(buildProfileFromInputs(inputs('  ', ' '), metric, { weightKg: 80, age: 30 })).toEqual({});
  });

  it('ignores an out-of-range value that slips past validation, keeping the saved one', () => {
    const prev = { weightKg: 80, age: 30 };
    expect(buildProfileFromInputs(inputs('5', '250'), metric, prev)).toEqual(prev);
    expect(buildProfileFromInputs(inputs('abc', '30.5'), metric, prev)).toEqual(prev);
  });

  it('accepts a decimal comma', () => {
    expect(buildProfileFromInputs(inputs('80,5'), metric, {}).weightKg).toBe(80.5);
  });

  it('keeps the saved gender when none is picked — it can change but not be cleared', () => {
    expect(buildProfileFromInputs(inputs(''), metric, { sex: 'female' }).sex).toBe('female');
    expect(buildProfileFromInputs(inputs('', '', 'male'), metric, { sex: 'female' }).sex).toBe('male');
    expect(buildProfileFromInputs(inputs(''), metric, {})).not.toHaveProperty('sex');
  });
});

describe('validateBiodataInputs', () => {
  const errors = (weight: string, age: string, units: BiodataUnits = metric) => validateBiodataInputs(inputs(weight, age), units);

  it('accepts 30–300 kg and 66–660 lb, inclusive, in the unit typed', () => {
    for (const w of ['30', '300', '80.5']) expect(errors(w, '').weight).toBeUndefined();
    for (const w of ['29.9', '300.1', '5', '0', '-80']) expect(errors(w, '').weight).toBe('Enter a weight between 30 and 300 kg');
    for (const w of ['66', '660', '176']) expect(errors(w, '', imperial).weight).toBeUndefined();
    // 5 lb (MUS-156) and 65 lb are refused; 30 kg ≈ 66.1 lb so the lb floor is 66.
    for (const w of ['5', '65', '661']) expect(errors(w, '', imperial).weight).toBe('Enter a weight between 66 and 660 lb');
    expect(errors('abc', '').weight).toBeDefined();
    expect(errors('80kg', '').weight).toBeDefined();
  });

  it('accepts whole-year ages 13–100, inclusive', () => {
    for (const a of ['13', '30', '100']) expect(errors('', a).age).toBeUndefined();
    // 250 (MUS-157) is refused rather than dropped.
    for (const a of ['12', '101', '250', '0', '30.5', 'abc']) expect(errors('', a).age).toBe('Enter an age between 13 and 100');
  });

  it('blank fields are valid — they clear', () => {
    expect(errors('', '')).toEqual({});
  });

  it('range hints shown under the fields', () => {
    expect(weightRangeHint('lb')).toBe('Between 66 and 660 lb');
    expect(weightRangeHint('kg')).toBe('Between 30 and 300 kg');
    expect(ageRangeHint()).toBe('Between 13 and 100');
  });
});

describe('biodataSummary', () => {
  it('says what biodata is for until something is saved', () => {
    expect(biodataSummary({}, metric)).toBe('Used for strength standards');
    expect(BIODATA_EMPTY_HINT).not.toMatch(/recovery/i);
  });

  it('summarises the saved fields in display units', () => {
    expect(biodataSummary({ weightKg: 80, age: 30, sex: 'male' }, metric)).toBe('80 kg · 30 · Male');
    expect(biodataSummary({ age: 41 }, metric)).toBe('41');
    expect(biodataSummary({ weightKg: 80, sex: 'female' }, imperial)).toBe('176.4 lb · Female');
    expect(biodataSummary({ sex: 'female' }, metric)).toBe('Female');
  });
});
