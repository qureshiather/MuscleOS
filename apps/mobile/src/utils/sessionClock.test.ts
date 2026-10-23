import { describe, expect, it } from 'vitest';
import { sessionSyncClock } from './sessionClock';

describe('sessionSyncClock', () => {
  const startedAt = '2026-10-20T10:00:00.000Z';
  const completedAt = '2026-10-20T11:00:00.000Z';

  it('is the edit time, then the finish time, then the start time', () => {
    expect(sessionSyncClock({ startedAt, completedAt, editedAt: '2026-10-22T09:00:00.000Z' })).toBe(
      '2026-10-22T09:00:00.000Z'
    );
    expect(sessionSyncClock({ startedAt, completedAt })).toBe(completedAt);
    expect(sessionSyncClock({ startedAt })).toBe(startedAt);
  });
});
