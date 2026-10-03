import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * subscriptionStore wiring on the AsyncStorage harness (docs/features/subscriptions.md). RevenueCat
 * and auth are mocked; the tier rules themselves are covered in src/subscription/state.test.ts.
 * The store keeps module-level state (load generation), so each test re-imports a fresh copy.
 */

const rc = {
  hasKey: true,
  customerInfo: null as unknown,
  purchase: { status: 'cancelled' } as unknown,
  restore: { status: 'error', message: 'nope' } as unknown,
};
const auth = { isAnonymous: false };

const ENT = 'MuscleOS Pro';
function proInfo(productIdentifier = 'muscleos_pro_annual', expirationDate = '2027-01-01T00:00:00Z') {
  return {
    entitlements: {
      active: { [ENT]: { isActive: true, productIdentifier, store: 'APP_STORE', expirationDate } },
    },
  };
}
const noProInfo = { entitlements: { active: {} } };

vi.mock('@/utils/revenueCat', () => {
  const ent = (ci: { entitlements: { active: Record<string, unknown> } } | null) =>
    ci?.entitlements.active['MuscleOS Pro'] as
      | { isActive: boolean; productIdentifier: string; store: string; expirationDate?: string }
      | undefined;
  return {
    ensureRevenueCatConfigured: vi.fn(async () => rc.hasKey),
    hasRevenueCatApiKey: () => rc.hasKey,
    getRevenueCatCustomerInfo: vi.fn(async () => rc.customerInfo),
    hasProEntitlement: (ci: never) => ent(ci)?.isActive === true,
    getProExpirationDate: (ci: never) => ent(ci)?.expirationDate,
    getProPlan: (ci: never) => {
      const e = ent(ci);
      if (!e?.isActive) return null;
      return e.productIdentifier === 'muscleos_pro_annual' ? 'annual' : 'monthly';
    },
    purchasePackage: vi.fn(async () => rc.purchase),
    restorePurchases: vi.fn(async () => rc.restore),
  };
});
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => auth } }));

async function fresh() {
  vi.resetModules();
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  const storage = await import('@/storage/localStorage');
  const rcMod = await import('@/utils/revenueCat');
  const { useSubscriptionStore } = await import('./subscriptionStore');
  return { AsyncStorage, storage, rcMod, store: useSubscriptionStore };
}

const proCached = { tier: 'pro' as const, expiresAt: '2027-01-01T00:00:00Z', plan: 'monthly' as const };

beforeEach(async () => {
  vi.stubGlobal('__DEV__', false);
  rc.hasKey = true;
  rc.customerInfo = null;
  rc.purchase = { status: 'cancelled' };
  rc.restore = { status: 'error', message: 'nope' };
  auth.isAnonymous = false;
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  await AsyncStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('initial state and hydrate()', () => {
  it('starts loading with no state', async () => {
    const { store } = await fresh();
    expect(store.getState()).toMatchObject({ state: null, isLoading: true });
    expect(store.getState().isPro()).toBe(false);
  });

  it('paints the cached tier and stops loading', async () => {
    const { store, storage } = await fresh();
    await storage.setSubscription(proCached);
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ state: proCached, isLoading: false });
  });

  it('is a no-op with no cache, or once something has set state', async () => {
    const { store, storage } = await fresh();
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ state: null, isLoading: true });
    store.setState({ state: { tier: 'basic' }, isLoading: false });
    await storage.setSubscription(proCached);
    await store.getState().hydrate();
    expect(store.getState().state).toEqual({ tier: 'basic' });
  });
});

describe('load()', () => {
  it('no API key and no cache → Basic, persisted', async () => {
    rc.hasKey = false;
    const { store, storage } = await fresh();
    await store.getState().load('u1');
    expect(store.getState()).toMatchObject({ state: { tier: 'basic' }, isLoading: false });
    expect(await storage.getSubscription()).toEqual({ tier: 'basic' });
  });

  it('active entitlement → Pro with plan and expiry, persisted', async () => {
    rc.customerInfo = proInfo();
    const { store, storage } = await fresh();
    await store.getState().load('u1');
    const expected = { tier: 'pro', expiresAt: '2027-01-01T00:00:00Z', plan: 'annual' };
    expect(store.getState().state).toEqual(expected);
    expect(await storage.getSubscription()).toEqual(expected);
  });

  it('no entitlement → Basic, overwriting a cached Pro (a real lapse)', async () => {
    rc.customerInfo = noProInfo;
    const { store, storage } = await fresh();
    await storage.setSubscription(proCached);
    await store.getState().load('u1');
    expect(store.getState().state).toEqual({ tier: 'basic' });
    expect(await storage.getSubscription()).toEqual({ tier: 'basic' });
  });

  it('a failed / timed-out customer read keeps a cached Pro user and the cache', async () => {
    rc.customerInfo = null;
    const { store, storage } = await fresh();
    await storage.setSubscription(proCached);
    await store.getState().load('u1');
    expect(store.getState()).toMatchObject({ state: proCached, isLoading: false });
    expect(await storage.getSubscription()).toEqual(proCached);
  });

  it('a guest is Basic even with the entitlement, and a cached Pro is rewritten to Basic', async () => {
    auth.isAnonymous = true;
    rc.customerInfo = proInfo();
    const { store, storage } = await fresh();
    await storage.setSubscription(proCached);
    await store.getState().load('guest');
    expect(store.getState().state).toEqual({ tier: 'basic' });
    expect(await storage.getSubscription()).toEqual({ tier: 'basic' });
  });

  it('migrates a legacy `free` cache to basic', async () => {
    rc.customerInfo = null;
    const { store, AsyncStorage } = await fresh();
    await AsyncStorage.setItem('muscleos_subscription', JSON.stringify({ tier: 'free' }));
    await store.getState().load('u1');
    expect(store.getState().state).toEqual({ tier: 'basic' });
  });

  it('release builds ignore and clear a leftover dev override', async () => {
    rc.customerInfo = noProInfo;
    const { store, storage } = await fresh();
    await storage.setDevProOverride(true);
    await store.getState().load('u1');
    expect(store.getState().state).toEqual({ tier: 'basic' });
    expect(await storage.getDevProOverride()).toBe(false);
  });

  it('dev builds honour the override, even for a guest', async () => {
    vi.stubGlobal('__DEV__', true);
    auth.isAnonymous = true;
    rc.customerInfo = noProInfo;
    const { store, storage } = await fresh();
    await storage.setDevProOverride(true);
    await store.getState().load('guest');
    expect(store.getState().isPro()).toBe(true);
    expect(store.getState().state?.plan).toBe('annual');
  });

  it('isPro() is false once a cached expiry has passed', async () => {
    const { store } = await fresh();
    store.setState({ state: { tier: 'pro', expiresAt: '2000-01-01T00:00:00Z' }, isLoading: false });
    expect(store.getState().isPro()).toBe(false);
  });
});

describe('purchase and restore', () => {
  const pkg = {} as never;

  it('refuses purchase and restore for guests', async () => {
    auth.isAnonymous = true;
    const { store, rcMod } = await fresh();
    expect(await store.getState().purchasePackage(pkg)).toEqual({
      success: false,
      error: 'Link an account to use Pro.',
    });
    expect(await store.getState().restorePurchases()).toEqual({
      success: false,
      error: 'Link an account to use Pro.',
    });
    expect(rcMod.purchasePackage).not.toHaveBeenCalled();
    expect(rcMod.restorePurchases).not.toHaveBeenCalled();
  });

  it('purchase: cancel, error, success, and completed-but-not-active', async () => {
    const { store, storage } = await fresh();
    rc.purchase = { status: 'cancelled' };
    expect(await store.getState().purchasePackage(pkg)).toEqual({ success: false, cancelled: true });
    rc.purchase = { status: 'error', message: 'Card declined' };
    expect(await store.getState().purchasePackage(pkg)).toEqual({ success: false, error: 'Card declined' });
    rc.purchase = { status: 'success', customerInfo: noProInfo };
    expect(await store.getState().purchasePackage(pkg)).toEqual({
      success: false,
      error: 'Purchase completed but Pro is not active yet. Try Restore purchases.',
    });
    rc.purchase = { status: 'success', customerInfo: proInfo('muscleos_pro_monthly') };
    expect(await store.getState().purchasePackage(pkg)).toEqual({ success: true });
    expect(store.getState().state).toMatchObject({ tier: 'pro', plan: 'monthly' });
    expect(await storage.getSubscription()).toMatchObject({ tier: 'pro', plan: 'monthly' });
  });

  it('restore: error, nothing found, restored', async () => {
    const { store } = await fresh();
    rc.restore = { status: 'error', message: 'Restore timed out. Try again.' };
    expect(await store.getState().restorePurchases()).toEqual({
      success: false,
      error: 'Restore timed out. Try again.',
    });
    rc.restore = { status: 'success', customerInfo: noProInfo };
    expect(await store.getState().restorePurchases()).toEqual({ success: true, restored: false });
    expect(store.getState().state).toEqual({ tier: 'basic' });
    rc.restore = { status: 'success', customerInfo: proInfo() };
    expect(await store.getState().restorePurchases()).toEqual({ success: true, restored: true });
    expect(store.getState().isPro()).toBe(true);
  });

  it('setPro / setBasic write the cache; release builds never persist a dev override', async () => {
    const { store, storage } = await fresh();
    await store.getState().setPro(undefined, { devOverride: true, plan: 'monthly' });
    expect(store.getState().state).toMatchObject({ tier: 'pro', plan: 'monthly' });
    expect(await storage.getDevProOverride()).toBe(false);
    await store.getState().setBasic();
    expect(await storage.getSubscription()).toEqual({ tier: 'basic' });
  });
});
