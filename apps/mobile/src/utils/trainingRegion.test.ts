import { describe, expect, it } from 'vitest';
import {
  getTrainingRegion,
  muscleDistribution,
  topMuscleLabels,
} from './trainingRegion';

describe('getTrainingRegion', () => {
  it('returns mixed for empty or evenly split work', () => {
    expect(getTrainingRegion([])).toBe('mixed');
    expect(getTrainingRegion(['chest', 'lats', 'quads', 'abs'])).toBe('mixed');
  });

  it('requires a region to cover at least half the work', () => {
    expect(getTrainingRegion(['chest', 'front_delts', 'triceps'])).toBe('push');
    expect(getTrainingRegion(['lats', 'biceps', 'chest'])).toBe('pull');
    expect(getTrainingRegion(['quads', 'hamstrings', 'glutes'])).toBe('legs');
  });
});

describe('muscleDistribution', () => {
  it('ranks muscles by how much of the work they account for', () => {
    const dist = muscleDistribution(['chest', 'chest', 'triceps', 'front_delts']);
    expect(dist[0]).toMatchObject({ id: 'chest', region: 'push', share: 0.5 });
    expect(dist.map((d) => d.id)).toEqual(['chest', 'triceps', 'front_delts']);
  });
});

describe('topMuscleLabels', () => {
  it('returns display names, not raw IDs', () => {
    expect(topMuscleLabels(['rear_delts', 'lats', 'lats'])).toEqual([
      'Lats',
      'Rear Delts',
    ]);
  });
});
