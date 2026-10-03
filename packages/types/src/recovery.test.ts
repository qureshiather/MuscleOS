import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECOVERY_HOURS,
  getRecoveryHoursForMuscle,
  getRecoveryUntil,
  RECOVERY_HOURS_BY_MUSCLE,
} from './recovery';
import { MUSCLE_GROUPS, type MuscleId } from './muscles';

describe('getRecoveryHoursForMuscle', () => {
  it('uses 36h for small groups, 72h for large groups, and 72h as the default', () => {
    expect(getRecoveryHoursForMuscle('biceps')).toBe(36);
    expect(getRecoveryHoursForMuscle('chest')).toBe(72);
    expect(getRecoveryHoursForMuscle('calves')).toBe(48);
    expect(getRecoveryHoursForMuscle('adductors')).toBe(48);
    expect(DEFAULT_RECOVERY_HOURS).toBe(72);
  });
});

describe('getRecoveryHoursForMuscle — every muscle', () => {
  const expected: Record<MuscleId, number> = {
    abs: 36,
    obliques: 36,
    biceps: 36,
    triceps: 36,
    forearms: 36,
    front_delts: 48,
    side_delts: 48,
    rear_delts: 48,
    calves: 48,
    adductors: 48,
    chest: 72,
    traps: 72,
    lats: 72,
    rhomboids: 72,
    lower_back: 72,
    quads: 72,
    hamstrings: 72,
    glutes: 72,
  };

  it.each(Object.entries(expected))('%s recovers in %i hours', (id, hours) => {
    expect(getRecoveryHoursForMuscle(id as MuscleId)).toBe(hours);
  });

  it('lists every muscle group in the table', () => {
    expect(Object.keys(RECOVERY_HOURS_BY_MUSCLE).sort()).toEqual(Object.keys(MUSCLE_GROUPS).sort());
  });

  it('falls back to 72 hours for an unknown id', () => {
    expect(getRecoveryHoursForMuscle('neck' as MuscleId)).toBe(DEFAULT_RECOVERY_HOURS);
  });
});

describe('getRecoveryUntil', () => {
  it('adds muscle-specific hours to trainedAt', () => {
    const trainedAt = '2026-09-12T12:00:00.000Z';
    expect(getRecoveryUntil({ muscleId: 'biceps', trainedAt })).toBe(
      '2026-09-14T00:00:00.000Z'
    );
    expect(getRecoveryUntil({ muscleId: 'chest', trainedAt })).toBe(
      '2026-09-15T12:00:00.000Z'
    );
  });
});
