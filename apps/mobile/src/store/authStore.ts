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

const AUTH_INIT_TIMEOUT_MS = 10_000;

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
    void revenueCatLogIn(u.id);
  }
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
    if (!isSupabaseConfigured()) {
      set({ user: null, isAnonymous: true, profile: null, isLoading: false });
      return null;
    }
    try {
      const sessionResult = await withTimeout(supabase.auth.getSession(), AUTH_INIT_TIMEOUT_MS);
      if (!sessionResult) {
        set({ user: null, isAnonymous: true, profile: null, isLoading: false });
        return null;
      }

      const {
        data: { session },
      } = sessionResult;

      if (session?.user) {
        const user = session.user;
        set({
          user,
          isAnonymous: user.is_anonymous ?? false,
          profile: userToProfile(user),
          isLoading: false,
        });
        return user.id;
      }

      const anonResult = await withTimeout(supabase.auth.signInAnonymously(), AUTH_INIT_TIMEOUT_MS);
      if (!anonResult) {
        set({ user: null, isAnonymous: true, profile: null, isLoading: false });
        return null;
      }
      const { data, error } = anonResult;
      if (error) {
        set({ user: null, isAnonymous: true, profile: null, isLoading: false });
        return null;
      }
      const user = data.user;
      if (!user) {
        set({ user: null, isAnonymous: true, profile: null, isLoading: false });
        return null;
      }
      set({
        user,
        isAnonymous: true,
        profile: null,
        isLoading: false,
      });
      return user.id;
    } catch {
      set({ user: null, isAnonymous: true, profile: null, isLoading: false });
      return null;
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) {
      set({ user: null, isAnonymous: true, profile: null });
      return;
    }
    try {
      await supabase.auth.signOut();
      const { data } = await supabase.auth.signInAnonymously();
      const user = data.user;
      set({
        user: user ?? null,
        isAnonymous: true,
        profile: null,
      });
      if (user?.id) {
        await revenueCatLogOut();
        await revenueCatLogIn(user.id);
      }
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
