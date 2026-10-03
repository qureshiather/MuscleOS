import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { localDayKey, monthGrid, sessionsOnDay, WEEKDAY_LABELS, workoutDaysSet } from './calendar';

const session = (id: string, completedAt: string | undefined): WorkoutSession => ({
  id,
  templateId: 't',
  startedAt: completedAt ?? new Date(2026, 0, 1).toISOString(),
  completedAt,
  exercises: [],
});

describe('WEEKDAY_LABELS', () => {
  it('starts the week on Monday', () => {
    expect(WEEKDAY_LABELS.join(' ')).toBe('M T W T F S S');
  });
});

describe('monthGrid', () => {
  it('puts the 1st under its weekday with Monday as column 0', () => {
    // 1 Sep 2026 is a Tuesday → one leading blank.
    expect(monthGrid(2026, 8)[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
    // 1 Feb 2026 is a Sunday → six leading blanks, the 1st in the last column.
    expect(monthGrid(2026, 1)[0]).toEqual([null, null, null, null, null, null, 1]);
    // 1 Jun 2026 is a Monday → no leading blanks.
    expect(monthGrid(2026, 5)[0][0]).toBe(1);
  });

  it('fills every row to 7 with trailing blanks and covers every day once', () => {
    for (const [year, month, days] of [
      [2026, 8, 30],
      [2026, 1, 28],
      [2028, 1, 29], // leap year
      [2026, 11, 31],
    ] as const) {
      const rows = monthGrid(year, month);
      for (const row of rows) expect(row).toHaveLength(7);
      const flat = rows.flat().filter((d): d is number => d != null);
      expect(flat).toEqual(Array.from({ length: days }, (_, i) => i + 1));
      expect(rows[rows.length - 1].some((d) => d != null)).toBe(true);
    }
    // 30 Sep 2026 is a Wednesday → four trailing blanks.
    const sep = monthGrid(2026, 8);
    expect(sep[sep.length - 1]).toEqual([28, 29, 30, null, null, null, null]);
  });

  it('needs only four rows for a 28-day February starting on Monday', () => {
    expect(monthGrid(2027, 1)).toHaveLength(4); // 1 Feb 2027 is a Monday
  });
});

describe('localDayKey / workoutDaysSet / sessionsOnDay', () => {
  it('keys by the local calendar day, either side of local midnight', () => {
    expect(localDayKey(new Date(2026, 8, 7, 0, 0, 0))).toBe('2026-09-07');
    expect(localDayKey(new Date(2026, 8, 6, 23, 59, 59))).toBe('2026-09-06');
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('marks days with a completed session and ignores in-progress ones', () => {
    const days = workoutDaysSet([
      session('a', new Date(2026, 8, 6, 23, 59).toISOString()),
      session('b', new Date(2026, 8, 7, 0, 1).toISOString()),
      session('c', undefined),
    ]);
    expect([...days].sort()).toEqual(['2026-09-06', '2026-09-07']);
  });

  it('lists the sessions completed on a local day', () => {
    const sessions = [
      session('late', new Date(2026, 8, 6, 23, 59).toISOString()),
      session('early', new Date(2026, 8, 7, 0, 1).toISOString()),
      session('noon', new Date(2026, 8, 7, 12).toISOString()),
      session('open', undefined),
    ];
    expect(sessionsOnDay(sessions, '2026-09-07').map((s) => s.id)).toEqual(['early', 'noon']);
    expect(sessionsOnDay(sessions, '2026-09-08')).toEqual([]);
  });
});
