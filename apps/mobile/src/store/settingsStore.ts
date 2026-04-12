import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit, HeightUnit } from '@/utils/weightUnits';

const UNIT_SYSTEM_KEY = 'muscleos_unit_system';
const PROFILE_KEY = 'muscleos_profile';
const WEIGHT_UNIT_KEY_LEGACY = 'muscleos_weight_unit';
const HEIGHT_UNIT_KEY = 'muscleos_height_unit';
const EXERCISE_WEIGHT_UNIT_KEY = 'muscleos_exercise_weight_unit';
const BODY_WEIGHT_UNIT_KEY = 'muscleos_body_weight_unit';
const WORKOUT_SOUNDS_KEY = 'muscleos_workout_sounds';

export interface UserAppProfile {
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: 'male' | 'female';
}

export interface SettingsState {
  /** Stored height display (profile, etc.) */
  heightUnit: HeightUnit;
  /** Exercise loads: workouts, PRs, templates */
  weightUnit: WeightUnit;
  /** Profile body weight display */
  bodyWeightUnit: WeightUnit;
  /** Beeps during active workout (rest countdown, set done, workout finished) */
  workoutSoundsEnabled: boolean;
  profile: UserAppProfile;
  isLoading: boolean;
  load: () => Promise<void>;
  setHeightUnit: (unit: HeightUnit) => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setBodyWeightUnit: (unit: WeightUnit) => Promise<void>;
  setWorkoutSoundsEnabled: (enabled: boolean) => Promise<void>;
  setProfile: (profile: UserAppProfile) => Promise<void>;
}

type UnitSystem = 'metric' | 'imperial';

function unitSystemToWeight(s: UnitSystem): WeightUnit {
  return s === 'imperial' ? 'lb' : 'kg';
}
function unitSystemToHeight(s: UnitSystem): HeightUnit {
  return s === 'imperial' ? 'in' : 'cm';
}

function parseHeightUnit(s: string | null): HeightUnit | null {
  if (s === 'cm' || s === 'in') return s;
  return null;
}

function parseWeightUnit(s: string | null): WeightUnit | null {
  if (s === 'kg' || s === 'lb') return s;
  return null;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  heightUnit: 'cm',
  weightUnit: 'kg',
  bodyWeightUnit: 'kg',
  workoutSoundsEnabled: true,
  profile: {},
  isLoading: true,

  load: async () => {
    try {
      const [systemStored, profileRaw, legacyWeight, heightRaw, exerciseStored, bodyStored, workoutSoundsRaw] =
        await Promise.all([
          AsyncStorage.getItem(UNIT_SYSTEM_KEY),
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(WEIGHT_UNIT_KEY_LEGACY),
          AsyncStorage.getItem(HEIGHT_UNIT_KEY),
          AsyncStorage.getItem(EXERCISE_WEIGHT_UNIT_KEY),
          AsyncStorage.getItem(BODY_WEIGHT_UNIT_KEY),
          AsyncStorage.getItem(WORKOUT_SOUNDS_KEY),
        ]);
      let unitSystem: UnitSystem = systemStored === 'imperial' ? 'imperial' : 'metric';
      if (!systemStored && (legacyWeight === 'lb' || heightRaw === 'in')) {
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

      const heightUnit =
        parseHeightUnit(heightRaw) ?? unitSystemToHeight(unitSystem);
      const weightUnit =
        parseWeightUnit(exerciseStored) ??
        parseWeightUnit(legacyWeight) ??
        unitSystemToWeight(unitSystem);
      const bodyWeightUnit = parseWeightUnit(bodyStored) ?? weightUnit;

      let workoutSoundsEnabled = true;
      if (workoutSoundsRaw === '0' || workoutSoundsRaw === 'false') workoutSoundsEnabled = false;
      if (workoutSoundsRaw === '1' || workoutSoundsRaw === 'true') workoutSoundsEnabled = true;

      const needsPersist =
        heightRaw == null || exerciseStored == null || bodyStored == null;
      if (needsPersist) {
        await AsyncStorage.multiSet([
          [HEIGHT_UNIT_KEY, heightUnit],
          [EXERCISE_WEIGHT_UNIT_KEY, weightUnit],
          [BODY_WEIGHT_UNIT_KEY, bodyWeightUnit],
        ]);
      }

      set({
        heightUnit,
        weightUnit,
        bodyWeightUnit,
        workoutSoundsEnabled,
        profile,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setHeightUnit: async (heightUnit) => {
    set({ heightUnit });
    await AsyncStorage.setItem(HEIGHT_UNIT_KEY, heightUnit);
  },

  setWeightUnit: async (weightUnit) => {
    set({ weightUnit });
    await AsyncStorage.setItem(EXERCISE_WEIGHT_UNIT_KEY, weightUnit);
  },

  setBodyWeightUnit: async (bodyWeightUnit) => {
    set({ bodyWeightUnit });
    await AsyncStorage.setItem(BODY_WEIGHT_UNIT_KEY, bodyWeightUnit);
  },

  setWorkoutSoundsEnabled: async (workoutSoundsEnabled) => {
    set({ workoutSoundsEnabled });
    await AsyncStorage.setItem(WORKOUT_SOUNDS_KEY, workoutSoundsEnabled ? '1' : '0');
  },

  setProfile: async (profile) => {
    set({ profile });
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },
}));
