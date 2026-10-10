import { describe, expect, it } from 'vitest';
import {
  equipmentLabel,
  EXERCISE_CATEGORIES,
  formatEquipmentLabels,
  instructionSteps,
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

describe('instructionSteps', () => {
  it('splits catalog copy into one step per line', () => {
    expect(instructionSteps('Brace your core\nPress the bar up\nLower slowly')).toEqual([
      'Brace your core',
      'Press the bar up',
      'Lower slowly',
    ]);
  });

  it('drops blank lines and typed list markers', () => {
    expect(instructionSteps('1. Sit tall\r\n\n- Pull to the hip\n• Squeeze\n2) Return')).toEqual([
      'Sit tall',
      'Pull to the hip',
      'Squeeze',
      'Return',
    ]);
  });

  it('keeps a single paragraph as one step and returns none for empty copy', () => {
    expect(instructionSteps('Lower the bar. Press it up.')).toEqual(['Lower the bar. Press it up.']);
    expect(instructionSteps(undefined)).toEqual([]);
    expect(instructionSteps('  \n ')).toEqual([]);
  });
});
