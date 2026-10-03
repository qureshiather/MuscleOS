import { describe, expect, it, vi } from 'vitest';
import { DELETE_ACCOUNT_DEPLOY_HINT, edgeFunctionErrorMessage, friendlyDeleteAccountError } from './edgeFunctionError';
import { AUTH_CALLBACK_FALLBACK_MS, emailLinkDestination } from './emailCallback';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));

/**
 * docs/features/accounts-and-data.md#authentication — where email links land, Delete account error
 * copy, and the Google client id lookup.
 */

describe('emailLinkDestination', () => {
  it('recovery opens New password; a confirmed or failed link goes to the tabs', () => {
    expect(emailLinkDestination({ result: 'recovery' })).toBe('/auth-new-password');
    expect(emailLinkDestination({ result: 'signed-in' })).toBe('/(tabs)');
    expect(emailLinkDestination({ result: 'failed', message: 'otp_expired' })).toBe('/(tabs)');
  });

  it('does not navigate for a URL that is not an auth link', () => {
    expect(emailLinkDestination({ result: 'ignored' })).toBeNull();
  });

  it('the callback route gives up after 15 s', () => {
    expect(AUTH_CALLBACK_FALLBACK_MS).toBe(15_000);
  });
});

describe('friendlyDeleteAccountError (A22)', () => {
  it('shows the deploy hint only in dev builds', async () => {
    const raw = await edgeFunctionErrorMessage({ message: 'Edge Function returned a non-2xx status code' }, null);
    expect(raw).toBe(DELETE_ACCOUNT_DEPLOY_HINT);
    expect(friendlyDeleteAccountError(new Error(raw), true)).toBe(DELETE_ACCOUNT_DEPLOY_HINT);
    expect(friendlyDeleteAccountError(new Error(raw), false)).toBe("Couldn't delete your account. Try again in a moment.");
  });

  it('never shows raw function or Supabase messages', () => {
    expect(friendlyDeleteAccountError(new Error('JWT expired'), false)).toBe(
      'Your sign-in has expired. Sign out, sign back in, and try again.'
    );
    for (const message of ['Unauthorized', 'Server misconfigured', 'Accounts are not configured.']) {
      const copy = friendlyDeleteAccountError(new Error(message), false);
      expect(copy).toBe("Couldn't delete your account. Try again in a moment.");
    }
    expect(friendlyDeleteAccountError('weird', false)).not.toContain('weird');
  });

  it('maps known cases to plain copy', () => {
    expect(friendlyDeleteAccountError(new Error('Network request failed'), false)).toMatch(/internet connection/);
    expect(friendlyDeleteAccountError(new Error('Request timed out'), false)).toMatch(/took too long/);
  });
});

describe('resolveGoogleWebClientId', () => {
  it('reads app config extra first, then the env var', async () => {
    const { resolveGoogleWebClientId } = await import('./googleSignIn');
    expect(resolveGoogleWebClientId({ googleWebClientId: ' extra-id ' }, 'env-id')).toBe('extra-id');
    expect(resolveGoogleWebClientId({ googleWebClientId: '' }, ' env-id ')).toBe('env-id');
    expect(resolveGoogleWebClientId(undefined, undefined)).toBe('');
  });
});
