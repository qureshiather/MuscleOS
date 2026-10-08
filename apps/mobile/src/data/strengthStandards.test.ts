import { describe, expect, it } from 'vitest';
import { compareToStrengthStandards, getStrengthStandards } from './strengthStandards';

describe('compareToStrengthStandards', () => {
  it('picks the highest band the ratio meets, scanning from elite down', () => {
    // Male bench: novice 0.75, intermediate 1.25
    const r = compareToStrengthStandards('bench-press', 100, 80, 'male');
    expect(r.ratio).toBe(1.25);
    expect(r.level).toBe('intermediate');
    expect(r.hasStandards).toBe(true);
  });

  it('targets bodyweight × the next level ratio', () => {
    const r = compareToStrengthStandards('bench-press', 100, 80, 'male');
    expect(r.nextLevelName).toBe('Advanced');
    expect(r.nextLevel1RMKg).toBe(80 * 1.75);
  });

  it('has no next level at elite', () => {
    const r = compareToStrengthStandards('deadlift', 300, 100, 'male');
    expect(r.level).toBe('elite');
    expect(r.nextLevel1RMKg).toBeNull();
    expect(r.nextLevelName).toBeNull();
  });

  it('uses the female tables', () => {
    // Female bench: intermediate 0.75, advanced 1.15 — 0.8 is intermediate for her, novice for him.
    expect(compareToStrengthStandards('bench-press', 48, 60, 'female').level).toBe('intermediate');
    expect(compareToStrengthStandards('bench-press', 48, 60, 'male').level).toBe('novice');
  });

  it('reports no standards for unsupported exercises', () => {
    const r = compareToStrengthStandards('bicep-curl', 40, 80, 'male');
    expect(r.hasStandards).toBe(false);
    expect(r.nextLevel1RMKg).toBeNull();
  });

  it('reports no standards for pull-ups, so no "Untrained" chip or strength card appears', () => {
    for (const sex of ['male', 'female'] as const) {
      const r = compareToStrengthStandards('pull-up', 200, 80, sex);
      expect(r.hasStandards).toBe(false);
      expect(r.nextLevel1RMKg).toBeNull();
      expect(r.nextLevelName).toBeNull();
    }
  });

  it('treats a missing bodyweight as a zero ratio', () => {
    expect(compareToStrengthStandards('squat', 100, 0, 'male').ratio).toBe(0);
  });
});

describe('age-adjusted standards', () => {
  it('without an age, or at 23–40, uses the tables unchanged', () => {
    for (const age of [undefined, 23, 30, 40]) {
      const r = compareToStrengthStandards('bench-press', 100, 80, 'male', age);
      expect(r.level).toBe('intermediate');
      expect(r.nextLevel1RMKg).toBe(80 * 1.75);
      expect(r.ageCoefficient).toBe(1);
    }
  });

  it('divides every threshold by the age coefficient', () => {
    // 60 → 1.34. Male bench intermediate 1.25 → 0.933, advanced 1.75 → 1.306.
    const r = compareToStrengthStandards('bench-press', 80, 80, 'male', 60);
    expect(r.ageCoefficient).toBe(1.34);
    expect(r.level).toBe('intermediate'); // ratio 1.0 is only novice unadjusted
    expect(compareToStrengthStandards('bench-press', 80, 80, 'male').level).toBe('novice');
    expect(r.nextLevel1RMKg).toBeCloseTo((80 * 1.75) / 1.34, 10);
  });

  it('lowers teen thresholds the same way', () => {
    // 16 → 1.13. Male squat intermediate 1.75 → 1.549.
    expect(compareToStrengthStandards('squat', 125, 80, 'male', 16).level).toBe('intermediate');
    expect(compareToStrengthStandards('squat', 125, 80, 'male').level).toBe('novice');
  });

  it('a level boundary sits exactly at threshold ÷ coefficient', () => {
    const boundary = (80 * 1.25) / 1.13; // 50 → 1.13, male bench intermediate
    expect(compareToStrengthStandards('bench-press', boundary, 80, 'male', 50).level).toBe('intermediate');
    expect(compareToStrengthStandards('bench-press', boundary - 0.01, 80, 'male', 50).level).toBe('novice');
  });

  it('reports no standards under 14', () => {
    const r = compareToStrengthStandards('bench-press', 100, 80, 'male', 13);
    expect(r.hasStandards).toBe(false);
    expect(r.nextLevel1RMKg).toBeNull();
  });
});

describe('getStrengthStandards', () => {
  it('covers exactly the documented lifts', () => {
    for (const id of [
      'bench-press',
      'close-grip-bench',
      'squat',
      'deadlift',
      'romanian-deadlift',
      'overhead-press',
      'barbell-row',
    ]) {
      expect(getStrengthStandards(id, 'male')).not.toBeNull();
      expect(getStrengthStandards(id, 'female')).not.toBeNull();
    }
    expect(getStrengthStandards('pull-up', 'male')).toBeNull();
    expect(getStrengthStandards('pull-up', 'female')).toBeNull();
  });

  it('keeps female thresholds below male ones', () => {
    const m = getStrengthStandards('squat', 'male')!;
    const f = getStrengthStandards('squat', 'female')!;
    for (const level of Object.keys(m) as (keyof typeof m)[]) expect(f[level]).toBeLessThan(m[level]);
  });
});
