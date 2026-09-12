import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { buildExercisePRs, estimatedOneRepMax } from './oneRepMax';

describe('estimatedOneRepMax', () => {
  it('uses the Epley formula and returns the weight for a true 1RM', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 5)).toBe(100 * (1 + 5 / 30));
    expect(estimatedOneRepMax(0, 5)).toBe(0);
    expect(estimatedOneRepMax(100, 0)).toBe(0);
  });
});

describe('buildExercisePRs', () => {
  it('tracks the best estimated 1RM per exercise from completed sets', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's1',
        templateId: 'push',
        startedAt: '2026-09-01T10:00:00.000Z',
        completedAt: '2026-09-01T11:00:00.000Z',
        exercises: [
          {
            exerciseId: 'bench-press',
            sets: [
              { weightKg: 80, reps: 5, completed: true },
              { weightKg: 90, reps: 1, completed: true },
              { weightKg: 100, reps: 3, completed: false },
            ],
          },
        ],
      },
      {
        id: 's2',
        templateId: 'push',
        startedAt: '2026-09-08T10:00:00.000Z',
        completedAt: '2026-09-08T11:00:00.000Z',
        exercises: [
          {
            exerciseId: 'bench-press',
            sets: [{ weightKg: 85, reps: 5, completed: true }],
          },
        ],
      },
    ];

    const [bench] = buildExercisePRs(sessions);
    expect(bench.exerciseId).toBe('bench-press');
    expect(bench.bestSet).toEqual({ weightKg: 85, reps: 5 });
    expect(bench.bestEstimated1RM).toBe(estimatedOneRepMax(85, 5));
    expect(bench.history).toHaveLength(3);
    expect(bench.history[0]?.completedAt).toBe('2026-09-08T11:00:00.000Z');
  });
});
