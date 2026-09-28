import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { formatSessionDuration, sessionVolumeKg } from './sessionStats';

const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 's',
  templateId: 't',
  startedAt: '2026-01-01T10:00:00.000Z',
  completedAt: '2026-01-01T11:00:00.000Z',
  exercises: [],
  ...over,
});

describe('sessionVolumeKg', () => {
  it('sums weight × reps over completed sets only, warm-ups included', () => {
    const s = session({
      exercises: [
        {
          exerciseId: 'bench',
          sets: [
            { completed: true, isWarmUp: true, weightKg: 20, reps: 10 },
            { completed: true, weightKg: 60, reps: 5 },
            { completed: false, weightKg: 100, reps: 5 },
            { completed: true, weightKg: 60 },
            { completed: true, reps: 12 },
          ],
        },
      ],
    });
    expect(sessionVolumeKg(s)).toBe(200 + 300);
  });

  it('is zero for an empty session', () => {
    expect(sessionVolumeKg(session())).toBe(0);
  });
});

describe('formatSessionDuration', () => {
  const at = (min: number) => new Date(Date.parse('2026-01-01T10:00:00.000Z') + min * 60_000).toISOString();

  it('formats minutes, hours and minutes, and whole hours', () => {
    expect(formatSessionDuration(session({ completedAt: at(45) }))).toBe('45m');
    expect(formatSessionDuration(session({ completedAt: at(75) }))).toBe('1h 15m');
    expect(formatSessionDuration(session({ completedAt: at(120) }))).toBe('2h');
  });

  it('rounds to the nearest minute', () => {
    expect(formatSessionDuration(session({ completedAt: at(44.5) }))).toBe('45m');
  });

  it('is null while in progress', () => {
    expect(formatSessionDuration(session({ completedAt: undefined }))).toBeNull();
  });
});
