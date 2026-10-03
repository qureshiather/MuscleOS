import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from '@/lib/withTimeout';
import { AUTH_INIT_TIMEOUT_MS, resolveLaunchUser, signOutToGuest, type InitAuthDeps } from './authSession';

/** docs/features/accounts-and-data.md#authentication — launch bootstrap and sign-out. */

type U = { id: string; is_anonymous?: boolean };

function deps(overrides: Partial<InitAuthDeps<U>> = {}): InitAuthDeps<U> {
  return {
    isConfigured: () => true,
    getSession: async () => ({ data: { session: null } }),
    signInAnonymously: async () => ({ data: { user: { id: 'anon-1', is_anonymous: true } }, error: null }),
    withTimeout,
    ...overrides,
  };
}

describe('resolveLaunchUser', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reuses an existing session without signing in again', async () => {
    const signInAnonymously = vi.fn();
    const user = await resolveLaunchUser(
      deps({ getSession: async () => ({ data: { session: { user: { id: 'linked-1' } } } }), signInAnonymously })
    );
    expect(user).toEqual({ id: 'linked-1' });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously on first launch', async () => {
    expect(await resolveLaunchUser(deps())).toEqual({ id: 'anon-1', is_anonymous: true });
  });

  it('stays an unauthenticated local guest when Supabase is not configured', async () => {
    const getSession = vi.fn();
    expect(await resolveLaunchUser(deps({ isConfigured: () => false, getSession }))).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('gives up after 10 s when getSession hangs', async () => {
    expect(AUTH_INIT_TIMEOUT_MS).toBe(10_000);
    const pending = resolveLaunchUser(deps({ getSession: () => new Promise(() => {}) }));
    await vi.advanceTimersByTimeAsync(AUTH_INIT_TIMEOUT_MS);
    expect(await pending).toBeNull();
  });

  it('gives up when anonymous sign-in hangs or fails', async () => {
    const hanging = resolveLaunchUser(deps({ signInAnonymously: () => new Promise(() => {}) }));
    await vi.advanceTimersByTimeAsync(AUTH_INIT_TIMEOUT_MS);
    expect(await hanging).toBeNull();
    expect(
      await resolveLaunchUser(deps({ signInAnonymously: async () => ({ data: { user: null }, error: new Error('x') }) }))
    ).toBeNull();
    expect(await resolveLaunchUser(deps({ getSession: async () => Promise.reject(new Error('net')) }))).toBeNull();
  });
});

describe('signOutToGuest', () => {
  it('signs out, starts a new guest, re-points RevenueCat, then resets sync to that guest', async () => {
    const calls: string[] = [];
    const user = await signOutToGuest<U>({
      signOutGoogle: async () => {
        calls.push('google-out');
      },
      signOutSupabase: async () => {
        calls.push('supabase-out');
      },
      signInAnonymously: async () => {
        calls.push('anon');
        return { user: { id: 'guest-2' } };
      },
      revenueCatLogOut: async () => {
        calls.push('rc-out');
      },
      revenueCatLogIn: async (id) => {
        calls.push(`rc-in:${id}`);
      },
      resetSyncTransport: async (id) => {
        calls.push(`sync-reset:${id}`);
      },
    });
    expect(user).toEqual({ id: 'guest-2' });
    expect(calls).toEqual(['google-out', 'supabase-out', 'anon', 'rc-out', 'rc-in:guest-2', 'sync-reset:guest-2']);
  });

  it('still resets sync when no guest could be created', async () => {
    const reset = vi.fn(async () => undefined);
    await signOutToGuest<U>({
      signOutGoogle: async () => undefined,
      signOutSupabase: async () => undefined,
      signInAnonymously: async () => ({ user: null }),
      revenueCatLogOut: vi.fn(),
      revenueCatLogIn: vi.fn(),
      resetSyncTransport: reset,
    });
    expect(reset).toHaveBeenCalledWith(null);
  });
});
