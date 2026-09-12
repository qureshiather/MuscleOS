import { describe, expect, it } from 'vitest';
import { BAR_WEIGHT_KG, getPlatesForWeight } from './plateCalculator';

describe('getPlatesForWeight', () => {
  it('returns null when the load is at or below the bar', () => {
    expect(getPlatesForWeight(BAR_WEIGHT_KG)).toBeNull();
    expect(getPlatesForWeight(15)).toBeNull();
  });

  it('splits plates symmetrically using the greedy kg set', () => {
    const load = getPlatesForWeight(100);
    expect(load).toEqual({
      weightKg: 100,
      platesPerSide: [
        { kg: 25, count: 1 },
        { kg: 15, count: 1 },
      ],
      totalPerSide: 40,
    });
  });
});
