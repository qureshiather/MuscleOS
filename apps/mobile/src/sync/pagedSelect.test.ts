import { describe, expect, it } from 'vitest';
import { selectAllPages } from './pagedSelect';

/** docs/features/accounts-and-data.md#outbox-push-and-pull — pulls page past the server's row cap. */

const source = Array.from({ length: 7 }, (_, i) => i);
const pages = (calls: [number, number][]) => async (from: number, to: number) => {
  calls.push([from, to]);
  return { data: source.slice(from, to + 1), error: null };
};

describe('selectAllPages', () => {
  it('keeps fetching until a short page, so rows past the cap are not skipped', async () => {
    const calls: [number, number][] = [];
    const result = await selectAllPages(pages(calls), 3);
    expect(result.data).toEqual(source);
    expect(calls).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it('asks once more after an exactly full last page', async () => {
    const calls: [number, number][] = [];
    const result = await selectAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: source.slice(0, 6).slice(from, to + 1), error: null };
    }, 3);
    expect(result.data).toHaveLength(6);
    expect(calls).toHaveLength(3);
  });

  it('returns the error from any page and no rows', async () => {
    let n = 0;
    const result = await selectAllPages(async () => {
      n += 1;
      return n === 2 ? { data: null, error: { message: 'timeout' } } : { data: [1, 2, 3], error: null };
    }, 3);
    expect(result).toEqual({ data: null, error: { message: 'timeout' } });
  });
});
