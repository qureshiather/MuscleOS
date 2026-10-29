import { beforeEach, describe, expect, it, vi } from 'vitest';

/** docs/features/accounts-and-data.md#authentication — turning an email link into a session. */

const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
}));
const authStore = vi.hoisted(() => ({
  applyAuthUser: vi.fn(),
  useAuthStore: { getState: () => ({ isAnonymous: true }) },
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
vi.mock('@/store/authStore', () => authStore);

const { completeEmailCallback } = await import('./completeEmailCallback');

const user = { id: 'u1' };
const ok = { data: { session: { user } }, error: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('completeEmailCallback', () => {
  it('a token hash is verified as an OTP; a recovery link asks for a new password', async () => {
    auth.verifyOtp.mockResolvedValue(ok);
    const result = await completeEmailCallback('muscleos://auth-callback?token_hash=abc&type=recovery');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' });
    expect(authStore.applyAuthUser).toHaveBeenCalledWith(user, 'SIGNED_IN', true);
    expect(result).toEqual({ result: 'recovery' });
  });

  it('a PKCE code is exchanged; a signup link signs in', async () => {
    auth.exchangeCodeForSession.mockResolvedValue(ok);
    const result = await completeEmailCallback('muscleos://auth-callback?code=xyz&type=signup');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
    expect(result).toEqual({ result: 'signed-in' });
  });

  it('implicit tokens set the session', async () => {
    auth.setSession.mockResolvedValue(ok);
    const result = await completeEmailCallback(
      'https://muscleos.app/auth/confirm#access_token=at&refresh_token=rt&type=signup'
    );
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    expect(result).toEqual({ result: 'signed-in' });
  });

  it('a Supabase error fails with its message and signs nobody in', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired' } });
    const result = await completeEmailCallback('muscleos://auth-callback?token_hash=abc&type=signup');
    expect(result).toEqual({ result: 'failed', message: 'Token has expired' });
    expect(authStore.applyAuthUser).not.toHaveBeenCalled();
  });

  it('ignores links that are not email callbacks', async () => {
    expect(await completeEmailCallback('muscleos://active-workout')).toEqual({ result: 'ignored' });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
