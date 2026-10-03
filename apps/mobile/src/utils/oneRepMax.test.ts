import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { buildExercisePRs, estimatedOneRepMax, formatE1RM } from './oneRepMax';

describe('estimatedOneRepMax', () => {
  it('uses the Epley formula and returns the weight for a true 1RM', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 5)).toBe(100 * (1 + 5 / 30));
    expect(estimatedOneRepMax(0, 5)).toBe(0);
    expect(estimatedOneRepMax(100, 0)).toBe(0);
    expect(estimatedOneRepMax(-5, 5)).toBe(0);
  });

  it('has no high-rep ceiling: 30 reps doubles the weight', () => {
    expect(estimatedOneRepMax(50, 30)).toBe(100);
    expect(estimatedOneRepMax(50, 60)).toBe(150);
  });

  it('does not round', () => {
    expect(estimatedOneRepMax(100, 2)).toBeCloseTo(106.6667, 4);
  });
});

describe('formatE1RM', () => {
  it('rounds to one decimal in kg and drops a trailing .0', () => {
    expect(formatE1RM(estimatedOneRepMax(100, 5), 'kg')).toBe('116.7 kg');
    expect(formatE1RM(estimatedOneRepMax(85, 5), 'kg')).toBe('99.2 kg');
    expect(formatE1RM(100, 'kg')).toBe('100 kg');
  });

  it('converts to pounds before rounding', () => {
    expect(formatE1RM(100, 'lb')).toBe('220.5 lb');
    expect(formatE1RM(estimatedOneRepMax(100, 5), 'lb')).toBe('257.2 lb');
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

const done = (id: string, completedAt: string, exerciseId: string, weightKg: number, reps: number): WorkoutSession => ({
  id,
  templateId: 't',
  startedAt: completedAt,
  completedAt,
  exercises: [{ exerciseId, sets: [{ weightKg, reps, completed: true }] }],
});

describe('buildExercisePRs rules', () => {
  it('only counts completed sets with weight > 0 and reps >= 1 in completed sessions', () => {
    const prs = buildExercisePRs([
      done('a', '2026-09-02T10:00:00.000Z', 'squat', 0, 5),
      done('b', '2026-09-01T10:00:00.000Z', 'squat', 100, 0),
      { ...done('c', '2026-09-03T10:00:00.000Z', 'squat', 200, 5), completedAt: undefined },
    ]);
    expect(prs).toEqual([]);
  });

  it('lists exercises by descending best e1RM', () => {
    const prs = buildExercisePRs([
      done('a', '2026-09-02T10:00:00.000Z', 'bench-press', 100, 1),
      done('b', '2026-09-01T10:00:00.000Z', 'deadlift', 180, 1),
      done('c', '2026-09-01T09:00:00.000Z', 'curl', 30, 10),
    ]);
    expect(prs.map((p) => p.exerciseId)).toEqual(['deadlift', 'bench-press', 'curl']);
  });

  it('breaks an e1RM tie in favour of the set that comes first (newest session)', () => {
    const [squat] = buildExercisePRs([
      done('new', '2026-09-08T10:00:00.000Z', 'squat', 100, 1),
      done('old', '2026-09-01T10:00:00.000Z', 'squat', 100, 1),
    ]);
    expect(squat.history).toHaveLength(2);
    expect(squat.bestSet).toEqual({ weightKg: 100, reps: 1 });
  });

  it('merges sets logged under an alias into the canonical exercise', () => {
    const canonical = (id: string) => (id === 'barbell-shrug' ? 'shrug' : id);
    const prs = buildExercisePRs(
      [
        done('new', '2026-09-08T10:00:00.000Z', 'shrug', 100, 5),
        done('old', '2026-09-01T10:00:00.000Z', 'barbell-shrug', 120, 5),
      ],
      canonical
    );
    expect(prs).toHaveLength(1);
    expect(prs[0].exerciseId).toBe('shrug');
    expect(prs[0].bestSet).toEqual({ weightKg: 120, reps: 5 });
    expect(prs[0].history.map((h) => h.weightKg)).toEqual([100, 120]);
  });
});
