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
