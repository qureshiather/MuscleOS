import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { computeHomeStats } from './homeStats';

function session(completedAt: string): WorkoutSession {
  return {
    id: completedAt,
    templateId: 'push',
    startedAt: completedAt,
    completedAt,
    exercises: [],
  };
}

describe('computeHomeStats', () => {
  it('counts sessions in the current Monday-start week', () => {
    const now = new Date(2026, 8, 12, 16, 0, 0);
    const stats = computeHomeStats(
      [
        session('2026-09-08T12:00:00'),
        session('2026-09-12T10:00:00'),
        session('2026-09-06T10:00:00'),
      ],
      now
    );
    expect(stats.sessionsThisWeek).toBe(2);
  });

  it('keeps last week in the streak while the current week is still in progress', () => {
    const monday = new Date(2026, 8, 14, 9, 0, 0);
    const stats = computeHomeStats(
      [session('2026-09-13T18:00:00'), session('2026-09-06T18:00:00')],
      monday
    );
    expect(stats.sessionsThisWeek).toBe(0);
    expect(stats.weekStreak).toBe(2);
  });

  it('breaks the streak after a missed week', () => {
    const now = new Date(2026, 8, 12, 16, 0, 0);
    const stats = computeHomeStats([session('2026-08-25T12:00:00')], now);
    expect(stats.weekStreak).toBe(0);
  });
});
