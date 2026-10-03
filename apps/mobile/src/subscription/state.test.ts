import { describe, expect, it } from 'vitest';
import {
  BASIC_STATE,
  cachedStateForPaint,
  isProState,
  normalizeStoredSubscription,
  resolveSubscriptionState,
} from './state';

const now = new Date('2026-06-01T00:00:00Z');
const proCached = { tier: 'pro' as const, expiresAt: '2027-01-01T00:00:00Z', plan: 'monthly' as const };

describe('isProState', () => {
  it('is false for null, Basic and legacy states', () => {
    expect(isProState(null, now)).toBe(false);
    expect(isProState(undefined, now)).toBe(false);
    expect(isProState({ tier: 'basic' }, now)).toBe(false);
  });

  it('is true for Pro with no expiry or a future expiry', () => {
    expect(isProState({ tier: 'pro' }, now)).toBe(true);
    expect(isProState(proCached, now)).toBe(true);
  });

  it('is false once the expiry has passed', () => {
    expect(isProState({ tier: 'pro', expiresAt: '2026-05-31T23:59:59Z' }, now)).toBe(false);
  });

  it('treats the exact expiry instant as still active', () => {
    expect(isProState({ tier: 'pro', expiresAt: now.toISOString() }, now)).toBe(true);
  });
});

describe('normalizeStoredSubscription', () => {
  it('migrates the legacy `free` tier (and unknown tiers) to basic', () => {
    expect(normalizeStoredSubscription({ tier: 'free' })).toEqual({ tier: 'basic' });
    expect(normalizeStoredSubscription({ tier: 'gold' })).toEqual({ tier: 'basic' });
    expect(normalizeStoredSubscription({})).toEqual({ tier: 'basic' });
    expect(normalizeStoredSubscription(null)).toBeNull();
  });
});

describe('cachedStateForPaint', () => {
  it('shows the cache as-is for a linked account', () => {
    expect(cachedStateForPaint({ stored: proCached, isGuest: false })).toEqual(proCached);
  });
  it('hides a cached Pro tier from a guest', () => {
    expect(cachedStateForPaint({ stored: proCached, isGuest: true })).toEqual(BASIC_STATE);
  });
  it('returns null when nothing is cached', () => {
    expect(cachedStateForPaint({ stored: null, isGuest: false })).toBeNull();
  });
});

describe('resolveSubscriptionState', () => {
  const base = {
    stored: null,
    isGuest: false,
    devOverride: false,
    isDev: false,
    hasApiKey: true,
    customerInfo: { active: false } as const,
    now,
  };

  it('dev override wins in dev builds — even for a guest — and keeps a cached Pro state', () => {
    const r = resolveSubscriptionState({ ...base, isDev: true, devOverride: true, isGuest: true, stored: proCached });
    expect(r).toEqual({ state: proCached, persist: false, clearDevOverride: false });
  });

  it('dev override without a cached Pro state grants annual Pro for a year', () => {
    const r = resolveSubscriptionState({ ...base, isDev: true, devOverride: true });
    expect(r.state).toEqual({ tier: 'pro', plan: 'annual', expiresAt: '2027-06-01T00:00:00.000Z' });
    expect(r.persist).toBe(false);
  });

  it('release builds ignore the override and ask for it to be cleared', () => {
    const r = resolveSubscriptionState({ ...base, devOverride: true });
    expect(r).toEqual({ state: BASIC_STATE, persist: true, clearDevOverride: true });
  });

  it('no override in dev behaves like release, without a clear', () => {
    expect(resolveSubscriptionState({ ...base, isDev: true }).clearDevOverride).toBe(false);
  });

  it('a guest is always Basic, even with an active entitlement or cached Pro', () => {
    const r = resolveSubscriptionState({
      ...base,
      isGuest: true,
      stored: proCached,
      customerInfo: { active: true, plan: 'annual' },
    });
    expect(r).toEqual({ state: BASIC_STATE, persist: true, clearDevOverride: false });
  });

  it('no RevenueCat API key → Basic', () => {
    expect(resolveSubscriptionState({ ...base, hasApiKey: false, stored: proCached }).state).toEqual(BASIC_STATE);
  });

  it('a failed customer read keeps a cached Pro user and does not overwrite the cache', () => {
    const r = resolveSubscriptionState({ ...base, stored: proCached, customerInfo: null });
    expect(r).toEqual({ state: proCached, persist: false, clearDevOverride: false });
  });

  it('a failed customer read with no cache is Basic, not persisted', () => {
    expect(resolveSubscriptionState({ ...base, customerInfo: null })).toEqual({
      state: BASIC_STATE,
      persist: false,
      clearDevOverride: false,
    });
  });

  it('a failed read keeps a legacy `free` cache as basic', () => {
    expect(resolveSubscriptionState({ ...base, stored: { tier: 'free' }, customerInfo: null }).state).toEqual(
      BASIC_STATE
    );
  });

  it('an active entitlement → Pro with its expiry and plan, persisted', () => {
    const r = resolveSubscriptionState({
      ...base,
      customerInfo: { active: true, expiresAt: '2027-02-02T00:00:00Z', plan: 'complimentary' },
    });
    expect(r).toEqual({
      state: { tier: 'pro', expiresAt: '2027-02-02T00:00:00Z', plan: 'complimentary' },
      persist: true,
      clearDevOverride: false,
    });
  });

  it('no entitlement → Basic, persisted (a real lapse downgrades the cache)', () => {
    expect(resolveSubscriptionState({ ...base, stored: proCached })).toEqual({
      state: BASIC_STATE,
      persist: true,
      clearDevOverride: false,
    });
  });
});
