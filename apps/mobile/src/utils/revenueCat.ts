/**
 * RevenueCat integration for Pro subscription.
 * Set EXPO_PUBLIC_REVENUECAT_API_KEY in app config or .env for real IAP.
 * In Expo Go, the SDK runs in preview/mock mode.
 */
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

/** API key from app config extra or env. Empty = skip RevenueCat (local/dev only). */
function getApiKey(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  return extra?.revenueCatApiKey ?? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
}

let configured = false;

export function isRevenueCatConfigured(): boolean {
  return configured && getApiKey().length > 0;
}

/** Call once at app start. Pass appUserId (e.g. Supabase user.id) for anonymous/linked identity. */
export function configureRevenueCat(appUserId?: string | null): void {
  if (configured) return;
  const apiKey = getApiKey();
  if (!apiKey) return;
  try {
    Purchases.configure({
      apiKey,
      appUserID: appUserId ?? undefined,
      shouldShowInAppMessagesAutomatically: false,
    });
    configured = true;
  } catch {
    // Expo Go or missing native module
  }
}

/** Switch RevenueCat to a different user (e.g. after sign out, new anonymous user). */
export async function revenueCatLogIn(appUserId: string): Promise<void> {
  if (!configured || !getApiKey()) return;
  try {
    await Purchases.logIn(appUserId);
  } catch {
    // ignore
  }
}

/** Sign out from RevenueCat (creates new anonymous identity). Call revenueCatLogIn(newUserId) after. */
export async function revenueCatLogOut(): Promise<void> {
  if (!configured || !getApiKey()) return;
  try {
    await Purchases.logOut();
  } catch {
    // ignore
  }
}

/** Get current customer info. Resolves to null if RevenueCat not configured or fails. */
export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) configureRevenueCat();
  if (!getApiKey()) return null;
  try {
    return await Purchases.getCustomerInfo();
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
  if (!configured) configureRevenueCat();
  if (!getApiKey()) {
    return { monthly: null, annual: null, lifetime: null };
  }
  try {
    const offerings = await Purchases.getOfferings();
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
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch {
    return null;
  }
}

/** Restore previous purchases. Returns updated CustomerInfo. */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!configured) configureRevenueCat();
  if (!getApiKey()) return null;
  try {
    return await Purchases.restorePurchases();
  } catch {
    return null;
  }
}
