import { describe, expect, it } from 'vitest';

import {
  beatsPrevious,
  completedVolume,
  formatClock,
  LIVE_EXERCISE_ID,
  LIVE_START,
  nextSetIndex,
  parseEntry,
  recoveryAfter,
} from './liveSet';

describe('nextSetIndex', () => {
  it('points at the first set still to do', () => {
    expect(nextSetIndex(LIVE_START)).toBe(0);
    expect(nextSetIndex([{ kg: 1, reps: 1, done: true }, ...LIVE_START.slice(1)])).toBe(1);
  });

  it('is -1 when every set is done', () => {
    expect(nextSetIndex(LIVE_START.map((s) => ({ ...s, done: true })))).toBe(-1);
  });
});

describe('beatsPrevious', () => {
  const previous = { kg: 80, reps: 8 };
  it('counts more weight, or more reps at the same weight', () => {
    expect(beatsPrevious({ kg: 82.5, reps: 5 }, previous)).toBe(true);
    expect(beatsPrevious({ kg: 80, reps: 9 }, previous)).toBe(true);
  });

  it('does not count a match or less', () => {
    expect(beatsPrevious({ kg: 80, reps: 8 }, previous)).toBe(false);
    expect(beatsPrevious({ kg: 77.5, reps: 12 }, previous)).toBe(false);
  });
});

describe('completedVolume', () => {
  it('sums only completed sets', () => {
    expect(
      completedVolume([
        { kg: 80, reps: 8, done: true },
        { kg: 100, reps: 5, done: false },
      ]),
    ).toBe(640);
  });
});

describe('formatClock', () => {
  it('formats m:ss and never goes negative', () => {
    expect(formatClock(120)).toBe('2:00');
    expect(formatClock(65.2)).toBe('1:06');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('parseEntry', () => {
  it('reads decimals with either separator', () => {
    expect(parseEntry('82.5', 0)).toBe(82.5);
    expect(parseEntry('82,5', 0)).toBe(82.5);
  });

  it('keeps the fallback for empty or invalid input', () => {
    expect(parseEntry('', 80)).toBe(80);
    expect(parseEntry('-4', 80)).toBe(80);
  });
});

describe('recoveryAfter', () => {
  it('lists the hero exercise muscles with the app recovery windows, longest first', () => {
    expect(recoveryAfter(LIVE_EXERCISE_ID)).toEqual([
      { id: 'chest', label: 'Chest', hours: 72 },
      { id: 'front_delts', label: 'Front Delts', hours: 48 },
      { id: 'triceps', label: 'Triceps', hours: 36 },
    ]);
  });
});
