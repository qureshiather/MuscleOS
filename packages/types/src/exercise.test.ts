import { describe, expect, it } from 'vitest';
import {
  equipmentLabel,
  EXERCISE_CATEGORIES,
  formatEquipmentLabels,
} from './exercise';

describe('exercise catalog helpers', () => {
  it('covers the four library filter categories', () => {
    expect(EXERCISE_CATEGORIES).toEqual([
      'free_weight',
      'machine',
      'cable',
      'bodyweight',
    ]);
  });

  it('formats equipment without showing raw IDs', () => {
    expect(equipmentLabel('ez_bar')).toBe('EZ Bar');
    expect(formatEquipmentLabels(['barbell', 'dumbbell'])).toBe('Barbell, Dumbbell');
  });
});
