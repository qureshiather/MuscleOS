import { describe, expect, it } from 'vitest';
import { formatClock, formatClockMs } from './formatClock';

describe('formatClock', () => {
  it('formats seconds as m:ss with padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(120)).toBe('2:00');
    expect(formatClock(900)).toBe('15:00');
  });

  it('does not roll minutes into hours', () => {
    expect(formatClock(75 * 60 + 3)).toBe('75:03');
  });

  it('floors fractions and reads negative or non-finite input as 0:00', () => {
    expect(formatClock(59.9)).toBe('0:59');
    expect(formatClock(-4)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('formatClockMs', () => {
  it('formats a millisecond duration', () => {
    expect(formatClockMs(0)).toBe('0:00');
    expect(formatClockMs(61_999)).toBe('1:01');
    expect(formatClockMs(12 * 60_000 + 5_000)).toBe('12:05');
  });
});
