import type { SetRecord, WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  formatCompactVolume,
  formatSessionDuration,
  formatSetGroups,
  formatVolume,
  sessionVolumeKg,
} from './sessionStats';

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

/** Sets from `[reps, kg]` pairs; omit kg for bodyweight. */
const sets = (...pairs: [number | undefined, number?][]): SetRecord[] =>
  pairs.map(([reps, weightKg]) => ({ reps, weightKg, completed: true }));

describe('formatSetGroups', () => {
  it('collapses identical sets', () => {
    expect(formatSetGroups(sets([8, 70], [8, 70], [8, 70]), 'kg')).toBe('3 × 8 @ 70 kg');
  });

  it('lists reps when they differ at one weight', () => {
    expect(formatSetGroups(sets([10, 60], [10, 60], [9, 60]), 'kg')).toBe('10 / 10 / 9 @ 60 kg');
  });

  it('splits into ordered groups when the weight changes, with the unit once', () => {
    expect(formatSetGroups(sets([8, 70], [8, 80], [6, 85]), 'kg')).toBe('8 @ 70 · 8 @ 80 · 6 @ 85 kg');
    expect(formatSetGroups(sets([5, 100], [5, 100], [3, 110]), 'kg')).toBe('2 × 5 @ 100 · 3 @ 110 kg');
  });

  it('only merges consecutive sets, so a return to an earlier weight is its own group', () => {
    expect(formatSetGroups(sets([8, 60], [6, 80], [10, 60]), 'kg')).toBe('8 @ 60 · 6 @ 80 · 10 @ 60 kg');
  });

  it('shows bodyweight-only lines without a unit', () => {
    expect(formatSetGroups(sets([10], [8], [7]), 'kg')).toBe('10 / 8 / 7');
    expect(formatSetGroups(sets([12], [12]), 'kg')).toBe('2 × 12');
  });

  it('labels bodyweight sets BW when the line also has weighted sets', () => {
    expect(formatSetGroups(sets([12], [8, 10], [8, 10]), 'kg')).toBe('12 BW · 2 × 8 @ 10 kg');
  });

  it('converts to pounds and groups on the displayed value', () => {
    expect(formatSetGroups(sets([5, 61.235], [5, 61.235]), 'lb')).toBe('2 × 5 @ 135 lb');
    expect(formatSetGroups(sets([10, 20.25]), 'kg')).toBe('10 @ 20.25 kg');
  });

  it('shows ? for missing reps', () => {
    expect(formatSetGroups(sets([undefined, 60]), 'kg')).toBe('? @ 60 kg');
  });
});

describe('formatVolume', () => {
  it('rounds to whole units and converts for lb', () => {
    expect(formatVolume(16456.4, 'kg')).toBe('16,456 kg');
    expect(formatVolume(1000, 'lb')).toBe('2,205 lb');
  });
});

describe('formatCompactVolume', () => {
  it('keeps whole numbers below 10k and switches to one-decimal thousands above', () => {
    expect(formatCompactVolume(8240.4, 'kg')).toBe('8,240 kg');
    expect(formatCompactVolume(12_140, 'kg')).toBe('12.1k kg');
    expect(formatCompactVolume(10_000, 'kg')).toBe('10k kg');
    expect(formatCompactVolume(10_000, 'lb')).toBe('22k lb');
  });
});
