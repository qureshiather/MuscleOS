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

  it('never assigns a level from the all-zero pull-up table', () => {
    const r = compareToStrengthStandards('pull-up', 200, 80, 'male');
    expect(r.level).toBe('untrained');
    expect(r.nextLevel1RMKg).toBeNull();
  });

  it('treats a missing bodyweight as a zero ratio', () => {
    expect(compareToStrengthStandards('squat', 100, 0, 'male').ratio).toBe(0);
  });
});

describe('getStrengthStandards', () => {
  it('covers exactly the documented lifts (plus the disabled pull-up table)', () => {
    for (const id of [
      'bench-press',
      'close-grip-bench',
      'squat',
      'deadlift',
      'romanian-deadlift',
      'overhead-press',
      'barbell-row',
      'pull-up',
    ]) {
      expect(getStrengthStandards(id, 'male')).not.toBeNull();
      expect(getStrengthStandards(id, 'female')).not.toBeNull();
    }
  });

  it('keeps female thresholds below male ones', () => {
    const m = getStrengthStandards('squat', 'male')!;
    const f = getStrengthStandards('squat', 'female')!;
    for (const level of Object.keys(m) as (keyof typeof m)[]) expect(f[level]).toBeLessThan(m[level]);
  });
});
