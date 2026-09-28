import { describe, expect, it } from 'vitest';
import { formatRecoveryReady, formatRelative } from './relativeTime';

describe('formatRelative', () => {
  it('describes recent timestamps in coarse English', () => {
    const now = Date.now();
    expect(formatRelative(new Date(now - 10_000).toISOString())).toBe('Just now');
    expect(formatRelative(new Date(now - 2 * 60 * 60 * 1000).toISOString())).toBe(
      '2 hours ago'
    );
  });
});

describe('formatRecoveryReady', () => {
  const now = new Date(2026, 8, 12, 16, 0, 0);

  it('uses day-grain labels instead of clock times', () => {
    expect(formatRecoveryReady(new Date(2026, 8, 12, 22, 0, 0).toISOString(), now)).toBe(
      'Ready later today'
    );
    expect(formatRecoveryReady(new Date(2026, 8, 13, 9, 0, 0).toISOString(), now)).toBe(
      'Ready tomorrow'
    );
  });
});

describe('formatRelative branches', () => {
  const now = new Date(2026, 8, 12, 16, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('steps minutes → hours → days → weeks', () => {
    expect(formatRelative(ago(59_000), now)).toBe('Just now');
    expect(formatRelative(ago(5 * MIN), now)).toBe('5 min ago');
    expect(formatRelative(ago(HOUR), now)).toBe('1 hour ago');
    expect(formatRelative(ago(DAY), now)).toBe('1 day ago');
    expect(formatRelative(ago(6 * DAY), now)).toBe('6 days ago');
    expect(formatRelative(ago(7 * DAY), now)).toBe('1 week ago');
    expect(formatRelative(ago(27 * DAY), now)).toBe('3 weeks ago');
  });

  it('falls back to an absolute date from four weeks', () => {
    const iso = ago(28 * DAY);
    expect(formatRelative(iso, now)).toBe(new Date(iso).toLocaleDateString());
  });
});

describe('formatRecoveryReady far branches', () => {
  const now = new Date(2026, 8, 12, 16, 0, 0);

  it('uses a short weekday for 2–6 days out', () => {
    const until = new Date(2026, 8, 14, 9, 0, 0);
    expect(formatRecoveryReady(until.toISOString(), now)).toBe(
      `Ready ${until.toLocaleDateString(undefined, { weekday: 'short' })}`
    );
  });

  it('uses month and day from 7 days out', () => {
    const until = new Date(2026, 8, 19, 9, 0, 0);
    expect(formatRecoveryReady(until.toISOString(), now)).toBe(
      `Ready ${until.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    );
  });

  it('says later today for a deadline already passed today', () => {
    expect(formatRecoveryReady(new Date(2026, 8, 12, 8, 0, 0).toISOString(), now)).toBe(
      'Ready later today'
    );
  });
});
