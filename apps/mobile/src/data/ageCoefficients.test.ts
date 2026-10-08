import { describe, expect, it } from 'vitest';
import { ageCoefficient, MAX_COEFFICIENT_AGE, MIN_STANDARDS_AGE } from './ageCoefficients';

/** docs/features/history-analytics.md#strength-standards — age coefficients. */

describe('ageCoefficient', () => {
  it('has no coefficient under 14 (no published standard)', () => {
    expect(MIN_STANDARDS_AGE).toBe(14);
    expect(ageCoefficient(13)).toBeNull();
    expect(ageCoefficient(1)).toBeNull();
  });

  it('uses the Foster coefficients from 14 to 22', () => {
    expect(ageCoefficient(14)).toBe(1.23);
    expect(ageCoefficient(17)).toBe(1.08);
    expect(ageCoefficient(18)).toBe(1.06);
    expect(ageCoefficient(22)).toBe(1.01);
  });

  it('is 1 from 23 to 40', () => {
    for (let age = 23; age <= 40; age++) expect(ageCoefficient(age)).toBe(1);
  });

  it('uses the McCulloch masters coefficients from 41 to 80', () => {
    expect(ageCoefficient(41)).toBe(1.01);
    expect(ageCoefficient(50)).toBe(1.13);
    expect(ageCoefficient(60)).toBe(1.34);
    expect(ageCoefficient(69)).toBe(1.61);
    expect(ageCoefficient(80)).toBe(2.05);
  });

  it('uses the USAPL coefficients from 81 to 90, then holds the age-90 value', () => {
    expect(MAX_COEFFICIENT_AGE).toBe(90);
    expect(ageCoefficient(81)).toBe(2.096);
    expect(ageCoefficient(90)).toBe(2.549);
    expect(ageCoefficient(95)).toBe(2.549);
    expect(ageCoefficient(149)).toBe(2.549);
  });

  it('only ever increases with age from 23 on, and decreases through the teens', () => {
    for (let age = 23; age < MAX_COEFFICIENT_AGE; age++) {
      expect(ageCoefficient(age + 1)!).toBeGreaterThanOrEqual(ageCoefficient(age)!);
    }
    for (let age = 14; age < 23; age++) {
      expect(ageCoefficient(age + 1)!).toBeLessThan(ageCoefficient(age)!);
    }
  });

  it('uses whole years', () => {
    expect(ageCoefficient(41.9)).toBe(1.01);
  });
});
