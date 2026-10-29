import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFetch } from './supabaseFetch';

/** docs/features/accounts-and-data.md — a hung request is aborted with a clear error. */

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

/** A fetch that never answers until its signal aborts, like a hung RN Android request. */
function hangingFetch() {
  return vi.fn(
    (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
  );
}

describe('createSupabaseFetch', () => {
  it('aborts after the timeout and reports it as a network TypeError', async () => {
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    const pending = createSupabaseFetch(1000)('https://example.test');
    const assertion = expect(pending).rejects.toThrow(new TypeError('Network request timed out after 1000ms'));
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('passes a response through and clears its timer', async () => {
    const response = new Response('ok');
    globalThis.fetch = vi.fn(async () => response) as unknown as typeof fetch;
    await expect(createSupabaseFetch(1000)('https://example.test', { method: 'POST' })).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
    expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('rethrows other failures unchanged', async () => {
    const failure = new TypeError('Network request failed');
    globalThis.fetch = vi.fn(async () => {
      throw failure;
    }) as unknown as typeof fetch;
    await expect(createSupabaseFetch(1000)('https://example.test')).rejects.toBe(failure);
  });
});
