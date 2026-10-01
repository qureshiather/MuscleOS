import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './authErrors';

describe('friendlyAuthError', () => {
  it('maps known Supabase errors to plain copy', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'sign_in')).toBe(
      "That email and password don't match. Check them, or use Forgot password."
    );
    expect(friendlyAuthError({ message: 'Password should be at least 6 characters.' }, 'sign_up')).toBe(
      'Use a password with at least 6 characters.'
    );
    expect(friendlyAuthError({ code: 'email_address_invalid', message: 'Email address "x" is invalid' }, 'sign_up')).toBe(
      'Enter a valid email address.'
    );
    expect(
      friendlyAuthError({ status: 429, message: 'For security purposes, you can only request this after 60 seconds.' }, 'sign_up')
    ).toBe('Too many attempts. Wait a minute and try again.');
    expect(friendlyAuthError({ message: 'Error sending confirmation email' }, 'sign_up')).toBe(
      "We couldn't send the confirmation email. Try again in a few minutes."
    );
    expect(friendlyAuthError({ message: 'New password should be different from the old password.' }, 'password')).toBe(
      'Choose a password different from your current one.'
    );
  });

  it('maps expired email links', () => {
    expect(friendlyAuthError({ code: 'otp_expired', message: 'Email link is invalid or has expired' }, 'link')).toBe(
      'This link has expired or was already used. Request a new one from the app.'
    );
  });

  it('maps network failures and timeouts', () => {
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError', message: 'Network request failed' }, 'sign_in')).toBe(
      "Couldn't reach MuscleOS. Check your internet connection and try again."
    );
    expect(friendlyAuthError({ message: 'Request timed out' }, 'sign_in')).toBe(
      'That took too long. Check your internet connection and try again.'
    );
  });

  it('never leaks unknown backend or provider messages', () => {
    for (const message of ['Database error saving new user', 'Unacceptable audience in id_token', 'supabase: 500']) {
      for (const context of ['sign_in', 'sign_up', 'google', 'apple', 'password', 'link'] as const) {
        const copy = friendlyAuthError({ message }, context);
        expect(copy.toLowerCase()).not.toContain('supabase');
        expect(copy).not.toContain(message);
      }
    }
    expect(friendlyAuthError({ message: 'Unacceptable audience in id_token' }, 'google')).toBe(
      "Couldn't sign in with Google. Try again, or use another sign-in option."
    );
    expect(friendlyAuthError(null, 'apple')).toBe("Couldn't sign in with Apple. Try again, or use another sign-in option.");
  });
});
