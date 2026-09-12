import { describe, expect, it } from 'vitest';
import { formatMuscleLabels, muscleLabel, MUSCLE_GROUPS } from './muscles';

describe('muscle labels', () => {
  it('never exposes raw snake_case IDs', () => {
    expect(muscleLabel('rear_delts')).toBe('Rear Delts');
    expect(muscleLabel('lower_back')).toBe('Lower Back');
    expect(formatMuscleLabels(['chest', 'triceps'])).toBe('Chest, Triceps');
  });

  it('has a group entry for every muscle ID used in recovery', () => {
    expect(Object.keys(MUSCLE_GROUPS).length).toBe(17);
  });
});
