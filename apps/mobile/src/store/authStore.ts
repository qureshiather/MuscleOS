import { create } from 'zustand';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import type { UserProfile, AuthProvider } from '@muscleos/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { revenueCatLogOut, revenueCatLogIn } from '@/utils/revenueCat';

const AUTH_INIT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

function userToProfile(user: User): UserProfile | null {
  if (user.is_anonymous) return null;
  const provider = (user.app_metadata?.provider as AuthProvider) ?? 'email';
  return {
    id: user.id,
    accountId: user.id,
    email: user.email ?? undefined,
    displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined,
    provider,
  };
}

/** Apply a signed-in user to local state and run link/sync side effects. */
export function applyAuthUser(u: User, event: AuthChangeEvent, wasAnonymous: boolean): void {
  useAuthStore.setState({
    user: u,
    isAnonymous: u.is_anonymous ?? false,
    profile: userToProfile(u),
  });

  const isNowLinked = !(u.is_anonymous ?? false);
  if (isNowLinked && wasAnonymous) {
    void import('@/sync').then((m) => m.onAccountLinked());
  } else if (isNowLinked && event === 'SIGNED_IN') {
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
}));

// Subscribe to auth state changes (for when user links identity)
if (isSupabaseConfigured()) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.user) return;
    const u = session.user;
    const prev = useAuthStore.getState();
    const nextAnonymous = u.is_anonymous ?? false;
    if (prev.user?.id === u.id && prev.isAnonymous === nextAnonymous) return;
    applyAuthUser(u, event, prev.isAnonymous);
  });
}
