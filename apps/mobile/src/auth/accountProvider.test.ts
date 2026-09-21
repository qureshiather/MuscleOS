import { describe, expect, it } from 'vitest';
import { authProviderLabel, linkedAuthProvider } from './accountProvider';

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
