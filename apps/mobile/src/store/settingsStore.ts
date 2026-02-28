import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit, HeightUnit } from '@/utils/weightUnits';

const UNIT_SYSTEM_KEY = 'muscleos_unit_system';
const PROFILE_KEY = 'muscleos_profile';
const WEIGHT_UNIT_KEY_LEGACY = 'muscleos_weight_unit';
const HEIGHT_UNIT_KEY_LEGACY = 'muscleos_height_unit';

export type UnitSystem = 'metric' | 'imperial';

export interface UserAppProfile {
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: 'male' | 'female';
}

export interface SettingsState {
  unitSystem: UnitSystem;
  /** Derived: metric = kg, imperial = lb */
  weightUnit: WeightUnit;
  /** Derived: metric = cm, imperial = in */
  heightUnit: HeightUnit;
  profile: UserAppProfile;
  isLoading: boolean;
  load: () => Promise<void>;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
  setProfile: (profile: UserAppProfile) => Promise<void>;
}

function unitSystemToWeight(s: UnitSystem): WeightUnit {
  return s === 'imperial' ? 'lb' : 'kg';
}
function unitSystemToHeight(s: UnitSystem): HeightUnit {
  return s === 'imperial' ? 'in' : 'cm';
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  unitSystem: 'metric',
  weightUnit: 'kg',
  heightUnit: 'cm',
  profile: {},
  isLoading: true,

  load: async () => {
    try {
      const [systemStored, profileRaw, legacyWeight, legacyHeight] = await Promise.all([
        AsyncStorage.getItem(UNIT_SYSTEM_KEY),
        AsyncStorage.getItem(PROFILE_KEY),
        AsyncStorage.getItem(WEIGHT_UNIT_KEY_LEGACY),
        AsyncStorage.getItem(HEIGHT_UNIT_KEY_LEGACY),
      ]);
      let unitSystem: UnitSystem = systemStored === 'imperial' ? 'imperial' : 'metric';
      if (!systemStored && (legacyWeight === 'lb' || legacyHeight === 'in')) {
        unitSystem = 'imperial';
        await AsyncStorage.setItem(UNIT_SYSTEM_KEY, 'imperial');
      }
      let profile: UserAppProfile = {};
      if (profileRaw) {
        try {
          profile = JSON.parse(profileRaw);
        } catch {
          // ignore
        }
      }
      set({
        unitSystem,
        weightUnit: unitSystemToWeight(unitSystem),
        heightUnit: unitSystemToHeight(unitSystem),
        profile,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setUnitSystem: async (unitSystem) => {
    set({
      unitSystem,
      weightUnit: unitSystemToWeight(unitSystem),
      heightUnit: unitSystemToHeight(unitSystem),
    });
    await AsyncStorage.setItem(UNIT_SYSTEM_KEY, unitSystem);
  },

  setProfile: async (profile) => {
    set({ profile });
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },
}));
