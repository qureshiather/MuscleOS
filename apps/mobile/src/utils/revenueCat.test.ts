import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * RevenueCat wrapper: entitlement reads and the restore fallback (a promotional grant lives only in
 * RevenueCat, so a failed store restore re-reads the customer before reporting failure).
 */

const purchases = {
  configure: vi.fn(),
  logIn: vi.fn(async () => ({})),
  getCustomerInfo: vi.fn(async (): Promise<unknown> => ({ entitlements: { active: {} } })),
  invalidateCustomerInfoCache: vi.fn(async () => undefined),
  restorePurchases: vi.fn(async (): Promise<unknown> => ({ entitlements: { active: {} } })),
  purchasePackage: vi.fn(async (): Promise<unknown> => ({})),
};

vi.mock('react-native-purchases', () => ({ default: purchases }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: { revenueCatApiKeyIos: 'appl_test' } } } }));

const pro = (productIdentifier: string, store = 'APP_STORE', expirationDate: string | null = '2027-01-01T00:00:00Z') => ({
  entitlements: { active: { 'MuscleOS Pro': { isActive: true, productIdentifier, store, expirationDate } } },
});

async function fresh() {
  vi.resetModules();
  return import('./revenueCat');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('entitlement helpers', () => {
  it('reads the MuscleOS Pro entitlement, its expiry and plan', async () => {
    const rc = await fresh();
    const info = pro('muscleos_pro_annual') as never;
    expect(rc.PRO_ENTITLEMENT_ID).toBe('MuscleOS Pro');
    expect(rc.hasProEntitlement(info)).toBe(true);
    expect(rc.getProExpirationDate(info)).toBe('2027-01-01T00:00:00Z');
    expect(rc.getProPlan(info)).toBe('annual');
    expect(rc.getProPlan(pro('rc_promo_x_lifetime', 'PROMOTIONAL', null) as never)).toBe('complimentary');
    expect(rc.getProExpirationDate(pro('rc_promo_x', 'PROMOTIONAL', null) as never)).toBeUndefined();
  });

  it('treats a missing customer or entitlement as not Pro', async () => {
    const rc = await fresh();
    expect(rc.hasProEntitlement(null)).toBe(false);
    expect(rc.hasProEntitlement({ entitlements: { active: {} } } as never)).toBe(false);
    expect(rc.getProPlan(null)).toBeNull();
  });

  it('has an API key from app config', async () => {
    const rc = await fresh();
    expect(rc.hasRevenueCatApiKey()).toBe(true);
  });
});

describe('restorePurchases', () => {
  it('returns the store restore result', async () => {
    const rc = await fresh();
    purchases.restorePurchases.mockResolvedValueOnce(pro('muscleos_pro_monthly'));
    const out = await rc.restorePurchases();
    expect(out.status).toBe('success');
    expect(purchases.invalidateCustomerInfoCache).not.toHaveBeenCalled();
  });

  it('falls back to a fresh customer read when the store restore fails (complimentary grant)', async () => {
    const rc = await fresh();
    purchases.restorePurchases.mockRejectedValueOnce(new Error('No Apple ID'));
    purchases.getCustomerInfo.mockResolvedValueOnce(pro('rc_promo_x', 'PROMOTIONAL'));
    const out = await rc.restorePurchases();
    expect(purchases.invalidateCustomerInfoCache).toHaveBeenCalled();
    expect(out.status).toBe('success');
  });

  it('reports the store error when the re-read has no entitlement either', async () => {
    const rc = await fresh();
    purchases.restorePurchases.mockRejectedValueOnce(new Error('No Apple ID'));
    expect(await rc.restorePurchases()).toEqual({ status: 'error', message: 'No Apple ID' });
  });
});

describe('purchasePackage', () => {
  it('distinguishes cancel from failure', async () => {
    const rc = await fresh();
    purchases.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect(await rc.purchasePackage({} as never)).toEqual({ status: 'cancelled' });
    purchases.purchasePackage.mockRejectedValueOnce({ message: '' });
    expect(await rc.purchasePackage({} as never)).toEqual({
      status: 'error',
      message: 'Could not complete purchase.',
    });
  });
});
