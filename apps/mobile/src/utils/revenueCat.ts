/**
 * RevenueCat integration for Pro subscription.
 * Set EXPO_PUBLIC_REVENUECAT_API_KEY in app config or .env for real IAP.
 * In Expo Go, the SDK runs in preview/mock mode.
 */
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import Constants from 'expo-constants';

export const PRO_ENTITLEMENT_ID = 'MuscleOS Pro';

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
    Purchases.configure({ apiKey, appUserID: appUserId ?? undefined });
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

/** Expiration date for Pro entitlement, ISO string or undefined. */
export function getProExpirationDate(customerInfo: CustomerInfo | null): string | undefined {
  if (!customerInfo) return undefined;
  const ent = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  const date = ent?.expirationDate;
  return date ?? undefined;
}

/** Get default offering and its default package (e.g. monthly). Used for purchase. */
export async function getDefaultPackage() {
  if (!configured) configureRevenueCat();
  if (!getApiKey()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current?.availablePackages?.length) return null;
    return current.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

/** Purchase the default package. Returns updated CustomerInfo on success. */
export async function purchasePro(): Promise<CustomerInfo | null> {
  const pkg = await getDefaultPackage();
  if (!pkg) return null;
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
