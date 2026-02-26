import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { UserProfile, AuthProvider } from '@muscleos/types';

const PROFILE_KEY = 'muscleos_profile';

export interface AuthState {
  profile: UserProfile | null;
  isLoading: boolean;
  setProfile: (profile: UserProfile | null) => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
}

async function getStoredProfile(): Promise<UserProfile | null> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

async function setStoredProfile(profile: UserProfile | null): Promise<void> {
  try {
    if (profile) {
      await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
    } else {
      await SecureStore.deleteItemAsync(PROFILE_KEY);
    }
  } catch {
    // ignore
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  isLoading: true,

  setProfile: async (profile) => {
    await setStoredProfile(profile);
    set({ profile });
  },

  signOut: async () => {
    await setStoredProfile(null);
    set({ profile: null });
  },

  loadProfile: async () => {
    set({ isLoading: true });
    const profile = await getStoredProfile();
    set({ profile, isLoading: false });
  },
}));
