import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, AuthProvider } from '@muscleos/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { revenueCatLogOut, revenueCatLogIn } from '@/utils/revenueCat';

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
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      const { data, error } = await supabase.auth.signInAnonymously();
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
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      const u = session.user;
      useAuthStore.setState({
        user: u,
        isAnonymous: u.is_anonymous ?? false,
        profile: userToProfile(u),
      });
    }
  });
}
