import { describe, expect, it } from 'vitest';
import { accountLinkSideEffect, identityAlreadyLinked } from './attachAccount';

describe('identityAlreadyLinked', () => {
  it('matches GoTrue identity_already_exists', () => {
    expect(identityAlreadyLinked({ code: 'identity_already_exists', message: 'Identity is already linked to another user' })).toBe(
      true
    );
  });

  it('matches the message when code is missing', () => {
    expect(identityAlreadyLinked({ message: 'Identity is already linked to another user' })).toBe(true);
  });

  it('ignores unrelated link failures', () => {
    expect(identityAlreadyLinked({ message: 'Linking requires a valid user access token' })).toBe(false);
    expect(identityAlreadyLinked(null)).toBe(false);
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
