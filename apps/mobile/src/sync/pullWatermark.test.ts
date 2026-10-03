import { describe, expect, it } from 'vitest';
import {
  advancePullCursor,
  EMPTY_PULL_CURSOR,
  isMissingServerClock,
  PULL_OVERLAP_MS,
  pullSince,
  unseenRows,
  type PullCursor,
  type PulledRow,
} from './pullWatermark';

/** docs/features/accounts-and-data.md#outbox-push-and-pull — the server-clock pull watermark (MUS-91). */

const S = '2026-06-01T00:00:00.000Z';
const at = (offsetMs: number) => new Date(Date.parse(S) + offsetMs).toISOString();
const row = (key: string, offsetMs: number): PulledRow => ({ key, serverUpdatedAt: at(offsetMs) });

describe('pullSince', () => {
  it('is null (full pull) without a watermark, when forced, or for a bad stamp', () => {
    expect(pullSince(EMPTY_PULL_CURSOR)).toBeNull();
    expect(pullSince({ watermark: S, seen: [] }, { full: true })).toBeNull();
    expect(pullSince({ watermark: 'not a date', seen: [] })).toBeNull();
  });

  it('starts the overlap window before the watermark', () => {
    expect(pullSince({ watermark: S, seen: [] })).toBe(at(-PULL_OVERLAP_MS));
  });
});

describe('advancePullCursor', () => {
  it('moves the watermark to the newest stamp and never back', () => {
    const c1 = advancePullCursor(EMPTY_PULL_CURSOR, [row('a', 0), row('b', 5000)]);
    expect(c1.watermark).toBe(at(5000));
    const c2 = advancePullCursor(c1, [row('c', 1000)]);
    expect(c2.watermark).toBe(at(5000));
  });

  it('keeps the server’s own stamp string (microsecond precision survives)', () => {
    const micro = '2026-06-01T00:00:01.123456+00:00';
    expect(advancePullCursor(EMPTY_PULL_CURSOR, [{ key: 'a', serverUpdatedAt: micro }]).watermark).toBe(micro);
  });

  it('remembers only rows inside the overlap window', () => {
    const c = advancePullCursor(EMPTY_PULL_CURSOR, [
      row('old', -PULL_OVERLAP_MS - 1),
      row('edge', -PULL_OVERLAP_MS),
      row('new', 0),
    ]);
    expect(c.seen.sort()).toEqual([`edge@${at(-PULL_OVERLAP_MS)}`, `new@${at(0)}`].sort());
  });

  it('drops remembered rows once the watermark moves past them', () => {
    const c1 = advancePullCursor(EMPTY_PULL_CURSOR, [row('a', 0)]);
    const c2 = advancePullCursor(c1, [row('b', PULL_OVERLAP_MS + 1)]);
    expect(c2.seen).toEqual([`b@${at(PULL_OVERLAP_MS + 1)}`]);
  });

  it('ignores rows with no stamp and stays empty with none', () => {
    expect(advancePullCursor(EMPTY_PULL_CURSOR, [{ key: 'a', serverUpdatedAt: '' }])).toEqual(EMPTY_PULL_CURSOR);
  });
});

describe('unseenRows', () => {
  it('skips rows already applied (same key and stamp) but keeps a newer write to the same key', () => {
    const cursor: PullCursor = advancePullCursor(EMPTY_PULL_CURSOR, [row('a', 0)]);
    const rows = [row('a', 0), row('a', 10), row('b', -5)];
    expect(unseenRows(rows, cursor, (r) => r)).toEqual([row('a', 10), row('b', -5)]);
  });

  it('returns everything for an empty cursor', () => {
    const rows = [row('a', 0)];
    expect(unseenRows(rows, EMPTY_PULL_CURSOR, (r) => r)).toBe(rows);
  });
});

describe('isMissingServerClock', () => {
  it('recognises the undefined-column error by code or by the column name', () => {
    expect(isMissingServerClock({ code: '42703', message: 'column does not exist' })).toBe(true);
    expect(isMissingServerClock({ message: 'Could not find the server_updated_at column' })).toBe(true);
    expect(isMissingServerClock({ code: 'PGRST301', message: 'JWT expired' })).toBe(false);
  });
});
