import { describe, expect, it } from 'vitest';
import { BIODATA_EMPTY_HINT, biodataSummary, buildProfileFromInputs } from './biodata';

/** docs/features/accounts-and-data.md#profile — the Biodata editor and the Profile tab hint. */

const metric = { heightUnit: 'cm' as const, bodyWeightUnit: 'kg' as const };
const imperial = { heightUnit: 'in' as const, bodyWeightUnit: 'lb' as const };
const inputs = (height: string, weight: string, age: string, sex: 'male' | 'female' | null = null) => ({
  height,
  weight,
  age,
  sex,
});

describe('buildProfileFromInputs', () => {
  it('stores metric input as entered', () => {
    expect(buildProfileFromInputs(inputs('180', '80.5', '30', 'male'), metric, {})).toEqual({
      heightCm: 180,
      weightKg: 80.5,
      age: 30,
      sex: 'male',
    });
  });

  it('converts imperial input to cm and kg', () => {
    expect(buildProfileFromInputs(inputs('70', '176', '30'), imperial, {})).toEqual({
      heightCm: 177.8,
      weightKg: 79.83,
      age: 30,
    });
  });

  it('clears height and weight that are not > 0, and age outside 1–149', () => {
    const prev = { heightCm: 180, weightKg: 80, age: 30 };
    expect(buildProfileFromInputs(inputs('0', '-5', '150'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('', 'abc', '0'), metric, prev)).toEqual({});
    expect(buildProfileFromInputs(inputs('1', '1', '149'), metric, {}).age).toBe(149);
    expect(buildProfileFromInputs(inputs('1', '1', '1'), metric, {}).age).toBe(1);
  });

  it('keeps the saved gender when none is picked — it can change but not be cleared', () => {
    expect(buildProfileFromInputs(inputs('', '', ''), metric, { sex: 'female' }).sex).toBe('female');
    expect(buildProfileFromInputs(inputs('', '', '', 'male'), metric, { sex: 'female' }).sex).toBe('male');
    expect(buildProfileFromInputs(inputs('', '', ''), metric, {})).not.toHaveProperty('sex');
  });
});

describe('biodataSummary', () => {
  it('says what biodata is for until something is saved', () => {
    expect(biodataSummary({}, metric)).toBe('Used for strength standards');
    expect(BIODATA_EMPTY_HINT).not.toMatch(/recovery/i);
  });

  it('summarises the saved fields in display units', () => {
    expect(biodataSummary({ heightCm: 180, weightKg: 80, age: 30, sex: 'male' }, metric)).toBe(
      '180 cm · 80 kg · 30 · Male'
    );
    expect(biodataSummary({ heightCm: 177.8, weightKg: 80, sex: 'female' }, imperial)).toBe('70 in · 176.4 lb · Female');
    expect(biodataSummary({ age: 41 }, metric)).toBe('41');
  });
});
