import { create } from 'zustand';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import type { UserProfile } from '@muscleos/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { revenueCatLogOut, revenueCatLogIn } from '@/utils/revenueCat';
import { withTimeout } from '@/lib/withTimeout';
import { getAppleAuthorizationCode } from '@/auth/appleAuthCode';
import { linkedAuthProvider } from '@/auth/accountProvider';
import { accountLinkSideEffect } from '@/auth/attachAccount';
import { edgeFunctionErrorMessage } from '@/auth/edgeFunctionError';
import {
  startFreshAnonymousGuest,
  wipeDeviceAfterAccountDeletion,
} from '@/auth/deleteAccount';
import { signOutGoogle } from '@/auth/googleSignIn';
import { resolveLaunchUser, signOutToGuest } from '@/auth/authSession';

function userToProfile(user: User): UserProfile | null {
  if (user.is_anonymous) return null;
  const provider = linkedAuthProvider(user);
  return {
    id: user.id,
    accountId: user.id,
    email: user.email ?? undefined,
    displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined,
    provider,
  };
}

/** Apply a signed-in user to local state and run link/sync side effects. */
export function applyAuthUser(u: User, _event: AuthChangeEvent, wasAnonymous: boolean): void {
  const previousUserId = useAuthStore.getState().user?.id ?? null;
  useAuthStore.setState({
    user: u,
    isAnonymous: u.is_anonymous ?? false,
    profile: userToProfile(u),
  });

  const isNowLinked = !(u.is_anonymous ?? false);
  const sideEffect = accountLinkSideEffect({
    previousUserId,
    nextUserId: u.id,
    wasAnonymous,
    isNowLinked,
  });
  if (sideEffect === 'upload_local') {
    void import('@/sync').then((m) => m.onAccountLinked());
  } else if (sideEffect === 'sync') {
    void import('@/sync').then((m) => m.syncNow());
  }

  if (isNowLinked && u.id) {
    // Guests are always Basic, so re-read the entitlement once the account is linked.
    void revenueCatLogIn(u.id)
      .then(() => import('@/store/subscriptionStore'))
      .then((m) => m.useSubscriptionStore.getState().load(u.id));
  }
}

/**
 * Re-read the signed-in user after adding Google or a password, so Account sees the new identity.
 * Same user id, so no link/sync side effects.
 */
export async function refreshAuthUser(): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return;
  useAuthStore.setState({ user: data.user, profile: userToProfile(data.user) });
}

export interface AuthState {
  user: User | null;
  isAnonymous: boolean;
  profile: UserProfile | null;
  isLoading: boolean;
  init: () => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAnonymous: true,
  profile: null,
  isLoading: true,

  init: async () => {
    set({ isLoading: true });
    const user = await resolveLaunchUser<User>({
      isConfigured: isSupabaseConfigured,
      getSession: () => supabase.auth.getSession(),
      signInAnonymously: () => supabase.auth.signInAnonymously(),
      withTimeout,
    });
    set({
      user,
      isAnonymous: user ? (user.is_anonymous ?? false) : true,
      profile: user ? userToProfile(user) : null,
      isLoading: false,
    });
    return user?.id ?? null;
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) {
      set({ user: null, isAnonymous: true, profile: null });
      return;
    }
    try {
      const user = await signOutToGuest<User>({
        signOutGoogle,
        signOutSupabase: () => supabase.auth.signOut(),
        signInAnonymously: async () => {
          const { data } = await supabase.auth.signInAnonymously();
          // Guest from here on, before RevenueCat and sync are re-pointed.
          set({ user: data.user ?? null, isAnonymous: true, profile: null });
          return { user: data.user ?? null };
        },
        revenueCatLogOut,
        revenueCatLogIn,
        resetSyncTransport: async (userId) => {
          const { resetSyncTransport } = await import('@/sync');
          await resetSyncTransport(userId);
        },
      });
      set({ user: user ?? null, isAnonymous: true, profile: null });
    } catch {
      set({ user: null, isAnonymous: true, profile: null });
    }
  },

  deleteAccount: async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('Accounts are not configured.');
    }
    const { user, isAnonymous } = get();
    if (!user || isAnonymous) {
      throw new Error('No account to delete.');
    }

    const appleAuthorizationCode = await getAppleAuthorizationCode();
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { appleAuthorizationCode: appleAuthorizationCode ?? undefined },
    });
    if (error) {
      throw new Error(await edgeFunctionErrorMessage(error, data));
    }

    await signOutGoogle();
    try {
      await supabase.auth.signOut();
    } catch {
      // The auth user is already gone; local session keys may still need a fresh guest.
    }

    const { useActiveWorkoutStore } = await import('@/store/activeWorkoutStore');
    useActiveWorkoutStore.getState().discardWorkout();
    await wipeDeviceAfterAccountDeletion();
    await startFreshAnonymousGuest({
      signInAnonymously: async () => {
        const { data } = await supabase.auth.signInAnonymously();
        return { user: data.user ? { id: data.user.id } : null };
      },
      revenueCatLogOut,
      revenueCatLogIn,
    });
    const {
      data: { user: nextUser },
    } = await supabase.auth.getUser();
    set({
      user: nextUser,
      isAnonymous: true,
      profile: null,
    });
  },
}));

// Subscribe to auth state changes (for when user links identity)
if (isSupabaseConfigured()) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.user) return;
    const u = session.user;
    const prev = useAuthStore.getState();

    // Stale INITIAL_SESSION from a timed-out getSession() must not revert a linked login.
    if (!prev.isAnonymous && (u.is_anonymous ?? false)) return;

    const nextAnonymous = u.is_anonymous ?? false;
    if (prev.user?.id === u.id && prev.isAnonymous === nextAnonymous) return;
    applyAuthUser(u, event, prev.isAnonymous);
  });
}
