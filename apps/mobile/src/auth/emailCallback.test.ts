import { describe, expect, it } from 'vitest';
import { emailCallbackNeedsNewPassword, parseEmailCallback } from './emailCallback';

describe('parseEmailCallback', () => {
  it('reads a recovery token hash from the app scheme', () => {
    const parsed = parseEmailCallback(
      'muscleos://auth-callback?token_hash=abc&type=recovery'
    );
    expect(parsed).toEqual({ kind: 'otp', tokenHash: 'abc', otpType: 'recovery' });
    expect(emailCallbackNeedsNewPassword(parsed)).toBe(true);
  });

  it('reads implicit tokens from the hash', () => {
    const parsed = parseEmailCallback(
      'https://muscleos.app/auth/confirm#access_token=at&refresh_token=rt&type=signup'
    );
    expect(parsed).toEqual({
      kind: 'session',
      accessToken: 'at',
      refreshToken: 'rt',
      linkType: 'signup',
    });
    expect(emailCallbackNeedsNewPassword(parsed)).toBe(false);
  });

  it('reads a PKCE code', () => {
    expect(parseEmailCallback('muscleos://auth-callback?code=xyz&type=recovery')).toEqual({
      kind: 'code',
      code: 'xyz',
      linkType: 'recovery',
    });
  });

  it('ignores unrelated links', () => {
    expect(parseEmailCallback('muscleos://active-workout')).toBeNull();
  });
});
