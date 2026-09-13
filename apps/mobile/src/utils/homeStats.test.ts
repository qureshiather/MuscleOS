import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { computeHomeStats, homeHeadline, type HomeStats } from './homeStats';

function session(completedAt: string): WorkoutSession {
  return {
    id: completedAt,
    templateId: 'push',
    startedAt: completedAt,
    completedAt,
    exercises: [],
  };
}

function stats(partial: Partial<HomeStats>): HomeStats {
  return {
    sessionsThisWeek: 0,
    weekStreak: 0,
    trainedToday: false,
    lastCompletedAt: null,
    ...partial,
  };
}

describe('computeHomeStats', () => {
  it('counts sessions in the current Monday-start week', () => {
    const now = new Date(2026, 8, 12, 16, 0, 0);
    const result = computeHomeStats(
      [
        session('2026-09-08T12:00:00'),
        session('2026-09-12T10:00:00'),
        session('2026-09-06T10:00:00'),
      ],
      now
    );
    expect(result.sessionsThisWeek).toBe(2);
    expect(result.trainedToday).toBe(true);
    expect(result.lastCompletedAt).toBe('2026-09-12T10:00:00');
  });

  it('keeps last week in the streak while the current week is still in progress', () => {
    const monday = new Date(2026, 8, 14, 9, 0, 0);
    const result = computeHomeStats(
      [session('2026-09-13T18:00:00'), session('2026-09-06T18:00:00')],
      monday
    );
    expect(result.sessionsThisWeek).toBe(0);
    expect(result.weekStreak).toBe(2);
    expect(result.trainedToday).toBe(false);
  });

  it('breaks the streak after a missed week', () => {
    const now = new Date(2026, 8, 12, 16, 0, 0);
    const result = computeHomeStats([session('2026-08-25T12:00:00')], now);
    expect(result.weekStreak).toBe(0);
  });
});

describe('homeHeadline', () => {
  it('celebrates an active streak', () => {
    expect(
      homeHeadline(stats({ sessionsThisWeek: 2, weekStreak: 3, trainedToday: true }))
    ).toBe("You're streaking. 3 weeks in.");
  });

  it('keeps a live streak honest when this week is still empty', () => {
    expect(homeHeadline(stats({ weekStreak: 3 }))).toBe("You're streaking. Week's still open.");
  });

  it('notes a single session logged today', () => {
    expect(
      homeHeadline(stats({ sessionsThisWeek: 1, weekStreak: 1, trainedToday: true }))
    ).toBe('Already in today.');
  });

  it('counts the week when they are not on a streak', () => {
    expect(homeHeadline(stats({ sessionsThisWeek: 2, weekStreak: 1 }))).toBe('Two this week.');
    expect(homeHeadline(stats({ sessionsThisWeek: 4, weekStreak: 1 }))).toBe('4 this week.');
  });

  it('mentions a recent gap without nagging a long one', () => {
    const wednesday = new Date(2026, 8, 9, 10, 0, 0);
    expect(
      homeHeadline(stats({ lastCompletedAt: '2026-09-08T18:00:00' }), wednesday)
    ).toBe('Last one was yesterday.');
    expect(
      homeHeadline(stats({ lastCompletedAt: '2026-09-06T18:00:00' }), wednesday)
    ).toBe('Last one was 3 days ago.');
    expect(
      homeHeadline(stats({ lastCompletedAt: '2026-08-28T18:00:00' }), wednesday)
    ).toBe('Pick a template or start from scratch');
  });

  it('invites a first session', () => {
    expect(homeHeadline(stats({}))).toBe('Pick a template or start from scratch');
  });
});
