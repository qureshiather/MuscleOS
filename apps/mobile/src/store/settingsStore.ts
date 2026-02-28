import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit, HeightUnit } from '@/utils/weightUnits';

const WEIGHT_UNIT_KEY = 'muscleos_weight_unit';
const HEIGHT_UNIT_KEY = 'muscleos_height_unit';
const PROFILE_KEY = 'muscleos_profile';

export interface UserAppProfile {
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: 'male' | 'female';
}

export interface SettingsState {
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  profile: UserAppProfile;
  isLoading: boolean;
  load: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setHeightUnit: (unit: HeightUnit) => Promise<void>;
  setProfile: (profile: UserAppProfile) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  weightUnit: 'kg',
  heightUnit: 'cm',
  profile: {},
  isLoading: true,

  load: async () => {
    try {
      const [weightStored, heightStored, profileRaw] = await Promise.all([
        AsyncStorage.getItem(WEIGHT_UNIT_KEY),
        AsyncStorage.getItem(HEIGHT_UNIT_KEY),
        AsyncStorage.getItem(PROFILE_KEY),
      ]);
      let profile: UserAppProfile = {};
      if (profileRaw) {
        try {
          profile = JSON.parse(profileRaw);
        } catch {
          // ignore
        }
      }
      set({
        weightUnit: weightStored === 'lb' ? 'lb' : 'kg',
        heightUnit: heightStored === 'in' ? 'in' : 'cm',
        profile,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setWeightUnit: async (unit) => {
    set({ weightUnit: unit });
    await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
  },

  setHeightUnit: async (unit) => {
    set({ heightUnit: unit });
    await AsyncStorage.setItem(HEIGHT_UNIT_KEY, unit);
  },

  setProfile: async (profile) => {
    set({ profile });
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },
}));
