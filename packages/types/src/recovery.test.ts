import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECOVERY_HOURS,
  getRecoveryHoursForMuscle,
  getRecoveryUntil,
  NOT_NATTY_RECOVERY_FACTOR,
} from './recovery';

describe('getRecoveryHoursForMuscle', () => {
  it('uses 36h for small groups, 72h for large groups, and 72h as the default', () => {
    expect(getRecoveryHoursForMuscle('biceps')).toBe(36);
    expect(getRecoveryHoursForMuscle('chest')).toBe(72);
    expect(getRecoveryHoursForMuscle('calves')).toBe(48);
    expect(DEFAULT_RECOVERY_HOURS).toBe(72);
  });

  it('halves recovery time when the enhanced protocol is on', () => {
    expect(getRecoveryHoursForMuscle('chest', { notNatty: true })).toBe(
      72 * NOT_NATTY_RECOVERY_FACTOR
    );
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
