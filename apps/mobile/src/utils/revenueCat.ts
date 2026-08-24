/**
 * RevenueCat integration for Pro subscription.
 * Set platform API keys in .env — Android requires the goog_ key, iOS the appl_ key.
 */
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import type { SubscriptionPlan } from '@muscleos/types';
import Constants from 'expo-constants';

export const PRO_ENTITLEMENT_ID = 'MuscleOS Pro';

/** App Store / Play product identifiers — must match store consoles and RevenueCat. */
export const PRODUCT_IDS = {
  monthly: 'muscleos_pro_monthly',
  annual: 'muscleos_pro_annual',
  lifetime: 'muscleos_pro_lifetime',
} as const;

export type OfferingPackages = {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
  lifetime: PurchasesPackage | null;
};

const RC_REQUEST_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** API key from app config extra or env. Platform-specific keys take precedence. */
function getApiKey(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fallback = extra?.revenueCatApiKey ?? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

  if (Platform.OS === 'android') {
    return (
      extra?.revenueCatApiKeyAndroid ??
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ??
      fallback
    );
  }
  if (Platform.OS === 'ios') {
    return (
      extra?.revenueCatApiKeyIos ??
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ??
      fallback
    );
  }
  return fallback;
}

let configured = false;
let configuredUserId: string | null = null;
/** Serializes configure so parallel callers never invoke Purchases.configure() twice. */
let configurePromise: Promise<boolean> | null = null;

/** True when an API key is present for this platform. */
export function hasRevenueCatApiKey(): boolean {
  return getApiKey().length > 0;
}

export function isRevenueCatConfigured(): boolean {
  return configured && getApiKey().length > 0;
}

/**
 * Configure RevenueCat once, then use logIn for user changes.
 * Safe to call from multiple places concurrently.
 */
export async function ensureRevenueCatConfigured(appUserId?: string | null): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  const result = await withTimeout(
    (async () => {
      if (!configurePromise) {
        configurePromise = (async () => {
          try {
            Purchases.configure({
              apiKey,
              appUserID: appUserId ?? undefined,
              shouldShowInAppMessagesAutomatically: false,
            });
            configured = true;
            configuredUserId = appUserId ?? null;
            return true;
          } catch {
            // Hot reload or second JS bundle: native SDK may already be configured.
            configured = true;
            return true;
          }
        })();
      }

      await configurePromise;

      if (appUserId && appUserId !== configuredUserId) {
        try {
          await Purchases.logIn(appUserId);
          configuredUserId = appUserId;
        } catch {
          // ignore — keep existing RC user
        }
      }

      return configured;
    })(),
    RC_REQUEST_TIMEOUT_MS
  );

  return result ?? false;
}

/** @deprecated Use ensureRevenueCatConfigured — kept for sync call sites during init. */
export function configureRevenueCat(appUserId?: string | null): void {
  void ensureRevenueCatConfigured(appUserId);
}

/** Switch RevenueCat to a different user (e.g. after sign out, new anonymous user). */
export async function revenueCatLogIn(appUserId: string): Promise<void> {
  if (!(await ensureRevenueCatConfigured(appUserId))) return;
  if (appUserId === configuredUserId) return;
  try {
    await Purchases.logIn(appUserId);
    configuredUserId = appUserId;
  } catch {
    // ignore
  }
}

/** Sign out from RevenueCat (creates new anonymous identity). Call revenueCatLogIn(newUserId) after. */
export async function revenueCatLogOut(): Promise<void> {
  if (!configured || !getApiKey()) return;
  try {
    await Purchases.logOut();
    configuredUserId = null;
  } catch {
    // ignore
  }
}

/** Get current customer info. Resolves to null if not configured, fails, or times out. */
export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!(await ensureRevenueCatConfigured())) return null;
  try {
    return await withTimeout(Purchases.getCustomerInfo(), RC_REQUEST_TIMEOUT_MS);
  } catch {
    return null;
  }
}

/** Whether the user has active Pro entitlement from RevenueCat. */
export function hasProEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  const ent = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  return ent?.isActive === true;
}

/** Expiration date for Pro entitlement, ISO string or undefined (lifetime). */
export function getProExpirationDate(customerInfo: CustomerInfo | null): string | undefined {
  if (!customerInfo) return undefined;
  const ent = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  const date = ent?.expirationDate;
  return date ?? undefined;
}

/** Derive billing plan from active Pro entitlement product identifier. */
export function getProPlan(customerInfo: CustomerInfo | null): SubscriptionPlan {
  if (!customerInfo) return null;
  const ent = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!ent?.isActive) return null;

  const productId = ent.productIdentifier;
  if (productId === PRODUCT_IDS.lifetime) return 'lifetime';
  if (productId === PRODUCT_IDS.annual) return 'annual';
  if (productId === PRODUCT_IDS.monthly) return 'monthly';
  if (!ent.expirationDate) return 'lifetime';
  return 'monthly';
}

export function isLifetimeEntitlement(customerInfo: CustomerInfo | null): boolean {
  return getProPlan(customerInfo) === 'lifetime';
}

/** Get packages from the current offering (monthly, annual, lifetime). */
export async function getOfferingPackages(): Promise<OfferingPackages> {
  if (!(await ensureRevenueCatConfigured())) {
    return { monthly: null, annual: null, lifetime: null };
  }
  try {
    const offerings = await withTimeout(Purchases.getOfferings(), RC_REQUEST_TIMEOUT_MS);
    if (!offerings) {
      return { monthly: null, annual: null, lifetime: null };
    }
    const current = offerings.current;
    if (!current) {
      return { monthly: null, annual: null, lifetime: null };
    }
    return {
      monthly: current.monthly ?? null,
      annual: current.annual ?? null,
      lifetime: current.lifetime ?? null,
    };
  } catch {
    return { monthly: null, annual: null, lifetime: null };
  }
}

/** Purchase a specific package. Returns updated CustomerInfo on success. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  if (!(await ensureRevenueCatConfigured())) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch {
    return null;
  }
}

/** Restore previous purchases. Returns updated CustomerInfo. */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!(await ensureRevenueCatConfigured())) return null;
  try {
    return await withTimeout(Purchases.restorePurchases(), RC_REQUEST_TIMEOUT_MS);
  } catch {
    return null;
  }
}
