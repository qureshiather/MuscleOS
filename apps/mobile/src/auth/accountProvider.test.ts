import { describe, expect, it } from 'vitest';
import {
  authProviderLabel,
  hasIdentity,
  hasPasswordSignIn,
  isPrivateRelayEmail,
  linkedAuthProvider,
} from './accountProvider';

describe('linkedAuthProvider', () => {
  it('prefers Apple over the leftover anonymous identity after linkIdentity', () => {
    expect(
      linkedAuthProvider({
        identities: [{ provider: 'anonymous' }, { provider: 'apple' }],
        app_metadata: { provider: 'anonymous', providers: ['anonymous', 'apple'] },
      })
    ).toBe('apple');
  });

  it('detects Google from identities', () => {
    expect(
      linkedAuthProvider({
        identities: [{ provider: 'google' }],
        app_metadata: { provider: 'google' },
      })
    ).toBe('google');
  });

  it('detects email from identities', () => {
    expect(
      linkedAuthProvider({
        identities: [{ provider: 'email' }],
        app_metadata: { provider: 'email' },
      })
    ).toBe('email');
  });

  it('falls back to app_metadata.providers when identities are missing', () => {
    expect(
      linkedAuthProvider({
        identities: [],
        app_metadata: { provider: 'anonymous', providers: ['anonymous', 'google'] },
      })
    ).toBe('google');
  });

  it('falls back to email when nothing linked is present', () => {
    expect(
      linkedAuthProvider({
        identities: [{ provider: 'anonymous' }],
        app_metadata: { provider: 'anonymous' },
      })
    ).toBe('email');
  });
});

describe('authProviderLabel', () => {
  it('uses store-facing names', () => {
    expect(authProviderLabel('apple')).toBe('Apple ID');
    expect(authProviderLabel('google')).toBe('Google');
    expect(authProviderLabel('email')).toBe('Email');
  });
});

describe('hasPasswordSignIn', () => {
  it('is true for an email identity, including alongside Apple or Google', () => {
    expect(hasPasswordSignIn({ identities: [{ provider: 'email' }] })).toBe(true);
    expect(hasPasswordSignIn({ identities: [{ provider: 'apple' }, { provider: 'email' }] })).toBe(true);
    expect(hasPasswordSignIn({ identities: [], app_metadata: { providers: ['email'] } })).toBe(true);
  });

  it('is false for Apple-only, Google-only, and anonymous users', () => {
    expect(hasPasswordSignIn({ identities: [{ provider: 'apple' }] })).toBe(false);
    expect(hasPasswordSignIn({ identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } })).toBe(false);
    expect(hasPasswordSignIn({ identities: [{ provider: 'anonymous' }] })).toBe(false);
    expect(hasPasswordSignIn({ identities: null })).toBe(false);
  });
});

describe('hasIdentity', () => {
  it('reads identities and app_metadata providers', () => {
    expect(hasIdentity({ identities: [{ provider: 'apple' }, { provider: 'google' }] }, 'google')).toBe(true);
    expect(hasIdentity({ identities: [], app_metadata: { providers: ['google'] } }, 'google')).toBe(true);
    expect(hasIdentity({ identities: [{ provider: 'apple' }] }, 'google')).toBe(false);
    expect(hasIdentity({ identities: null }, 'apple')).toBe(false);
  });
});

describe('isPrivateRelayEmail', () => {
  it('matches Apple Hide My Email addresses', () => {
    expect(isPrivateRelayEmail('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isPrivateRelayEmail(' ABC@PrivateRelay.AppleID.com ')).toBe(true);
  });

  it('is false for real addresses and missing email', () => {
    expect(isPrivateRelayEmail('me@gmail.com')).toBe(false);
    expect(isPrivateRelayEmail('me@icloud.com')).toBe(false);
    expect(isPrivateRelayEmail(null)).toBe(false);
    expect(isPrivateRelayEmail(undefined)).toBe(false);
  });
});
