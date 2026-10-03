/**
 * Auth bootstrap and sign-out, with Supabase / RevenueCat / sync passed in so the rules are unit
 * tested without a network. `authStore` wires the real dependencies.
 */
import { startFreshAnonymousGuest, type AnonymousGuestDeps } from '@/auth/deleteAccount';

/** Give up on `getSession` / `signInAnonymously` after this long and run as a local-only guest. */
export const AUTH_INIT_TIMEOUT_MS = 10_000;

export type SessionUser = { id: string; is_anonymous?: boolean };

export type InitAuthDeps<U extends SessionUser> = {
  isConfigured: () => boolean;
  getSession: () => Promise<{ data: { session: { user: U } | null } }>;
  signInAnonymously: () => Promise<{ data: { user: U | null }; error: unknown }>;
  withTimeout: <T>(promise: Promise<T>, ms: number) => Promise<T | null>;
};

/**
 * Launch: reuse the stored session, else sign in anonymously. Null (stay an unauthenticated,
 * device-only guest) when Supabase isn't configured, either call times out or fails.
 */
export async function resolveLaunchUser<U extends SessionUser>(deps: InitAuthDeps<U>): Promise<U | null> {
  if (!deps.isConfigured()) return null;
  try {
    const sessionResult = await deps.withTimeout(deps.getSession(), AUTH_INIT_TIMEOUT_MS);
    if (!sessionResult) return null;
    const existing = sessionResult.data.session?.user;
    if (existing) return existing;

    const anonResult = await deps.withTimeout(deps.signInAnonymously(), AUTH_INIT_TIMEOUT_MS);
    if (!anonResult || anonResult.error) return null;
    return anonResult.data.user ?? null;
  } catch {
    return null;
  }
}

export type SignOutDeps<U extends { id: string }> = AnonymousGuestDeps<U> & {
  signOutGoogle: () => Promise<void>;
  signOutSupabase: () => Promise<unknown>;
  /** Drop the old account's outbox and watermark; the new guest owns the (empty) transport. */
  resetSyncTransport: (userId: string | null) => Promise<void>;
};

/**
 * Sign out: leave the account, start a new anonymous guest, re-point RevenueCat at it, and reset
 * the sync transport so nothing queued for the old account reaches whichever account is next.
 * Local workout data stays on the device.
 */
export async function signOutToGuest<U extends { id: string }>(deps: SignOutDeps<U>): Promise<U | null> {
  await deps.signOutGoogle();
  await deps.signOutSupabase();
  const user = await startFreshAnonymousGuest(deps);
  await deps.resetSyncTransport(user?.id ?? null);
  return user;
}
