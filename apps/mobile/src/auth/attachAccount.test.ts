import { describe, expect, it } from 'vitest';
import { accountLinkSideEffect, identityAlreadyLinked, linkConflict, signUpOutcome } from './attachAccount';

describe('identityAlreadyLinked', () => {
  it('matches GoTrue identity_already_exists', () => {
    expect(identityAlreadyLinked({ code: 'identity_already_exists', message: 'Identity is already linked to another user' })).toBe(
      true
    );
  });

  it('matches the message when code is missing', () => {
    expect(identityAlreadyLinked({ message: 'Identity is already linked to another user' })).toBe(true);
  });

  it('matches an email that already has an account under another provider', () => {
    expect(identityAlreadyLinked({ code: 'email_exists', message: 'Email address already exists' })).toBe(true);
    expect(identityAlreadyLinked({ code: 'user_already_exists', message: 'User already registered' })).toBe(true);
    expect(identityAlreadyLinked({ message: 'A user with this email address has already been registered' })).toBe(
      true
    );
  });

  it('ignores unrelated link failures', () => {
    expect(identityAlreadyLinked({ message: 'Linking requires a valid user access token' })).toBe(false);
    expect(identityAlreadyLinked(null)).toBe(false);
  });
});

describe('linkConflict', () => {
  it('tells an identity on another user apart from an email on another user', () => {
    expect(linkConflict({ code: 'identity_already_exists', message: 'Identity is already linked to another user' })).toBe(
      'identity'
    );
    expect(linkConflict({ code: 'email_exists', message: 'Email address already exists' })).toBe('email');
    expect(linkConflict({ message: 'Linking requires a valid user access token' })).toBe(null);
    expect(linkConflict(null)).toBe(null);
  });
});

describe('accountLinkSideEffect', () => {
  it('uploads local data when an anonymous guest is upgraded in place', () => {
    expect(
      accountLinkSideEffect({
        previousUserId: 'guest-1',
        nextUserId: 'guest-1',
        wasAnonymous: true,
        isNowLinked: true,
      })
    ).toBe('upload_local');
  });

  it('syncs (pull) when signing into an existing account on a new device', () => {
    expect(
      accountLinkSideEffect({
        previousUserId: 'fresh-anon',
        nextUserId: 'original-apple-user',
        wasAnonymous: true,
        isNowLinked: true,
      })
    ).toBe('sync');
  });

  it('syncs when there was no prior session', () => {
    expect(
      accountLinkSideEffect({
        previousUserId: null,
        nextUserId: 'apple-user',
        wasAnonymous: true,
        isNowLinked: true,
      })
    ).toBe('sync');
  });

  it('does nothing while still anonymous', () => {
    expect(
      accountLinkSideEffect({
        previousUserId: 'guest-1',
        nextUserId: 'guest-1',
        wasAnonymous: true,
        isNowLinked: false,
      })
    ).toBe('none');
  });
});

describe('signUpOutcome', () => {
  it('treats an "already registered" error as an existing account (confirmations off)', () => {
    expect(signUpOutcome({ data: null, error: { code: 'user_already_exists', message: 'User already registered' } })).toBe(
      'existing'
    );
    expect(signUpOutcome({ data: null, error: { message: 'A user with this email address has already been registered' } })).toBe(
      'existing'
    );
  });

  it('treats a placeholder user with no identities as an existing account (confirmations on)', () => {
    expect(signUpOutcome({ data: { user: { identities: [] }, session: null }, error: null })).toBe('existing');
  });

  it('asks to confirm a new address that has no session yet', () => {
    expect(signUpOutcome({ data: { user: { identities: [{ provider: 'email' }] }, session: null }, error: null })).toBe(
      'confirm'
    );
    expect(signUpOutcome({ data: { user: { identities: null }, session: null }, error: null })).toBe('confirm');
  });

  it('signs in when signUp returns a session', () => {
    expect(
      signUpOutcome({ data: { user: { identities: [{ provider: 'email' }] }, session: { access_token: 't' } }, error: null })
    ).toBe('signed_in');
  });

  it('reports other errors as errors', () => {
    expect(signUpOutcome({ data: null, error: { code: 'weak_password', message: 'Password should be at least 6 characters.' } })).toBe(
      'error'
    );
  });
});
