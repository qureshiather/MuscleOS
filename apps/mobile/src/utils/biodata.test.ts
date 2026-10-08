import { describe, expect, it } from 'vitest';
import { BIODATA_EMPTY_HINT, biodataSummary, buildProfileFromInputs } from './biodata';

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

  it('clears a weight that is not > 0', () => {
    const prev = { weightKg: 80 };
    expect(buildProfileFromInputs(inputs('-5'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('0'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('abc'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs(''), metric, prev)).toEqual({});
  });

  it('clears an age outside 1–149', () => {
    const prev = { age: 30 };
    expect(buildProfileFromInputs(inputs('', '150'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('', '0'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('', 'abc'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('', '149'), metric, {}).age).toBe(149);
    expect(buildProfileFromInputs(inputs('', '1'), metric, {}).age).toBe(1);
  });

  it('keeps the saved gender when none is picked — it can change but not be cleared', () => {
    expect(buildProfileFromInputs(inputs(''), metric, { sex: 'female' }).sex).toBe('female');
    expect(buildProfileFromInputs(inputs('', '', 'male'), metric, { sex: 'female' }).sex).toBe('male');
    expect(buildProfileFromInputs(inputs(''), metric, {})).not.toHaveProperty('sex');
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
