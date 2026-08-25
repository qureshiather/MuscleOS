import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit, HeightUnit } from '@/utils/weightUnits';
import {
  getAppSettings,
  setAppSettings,
  type UserAppProfile,
  type SyncedAppSettings,
  type ThemePreference,
} from '@/storage/localStorage';
import { notifyAppSettingsSnapshot } from '@/sync';

export type { UserAppProfile, SyncedAppSettings, ThemePreference };

const UNIT_SYSTEM_KEY = 'muscleos_unit_system';
const HEIGHT_UNIT_KEY = 'muscleos_height_unit';
const EXERCISE_WEIGHT_UNIT_KEY = 'muscleos_exercise_weight_unit';
const BODY_WEIGHT_UNIT_KEY = 'muscleos_body_weight_unit';
const WEIGHT_UNIT_KEY_LEGACY = 'muscleos_weight_unit';

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
  setNotNatty: (notNatty: boolean) => Promise<void>;
}

async function persistAndNotify(partial: Partial<SyncedAppSettings>): Promise<void> {
  const current = await getAppSettings();
  const next: SyncedAppSettings = { ...current, ...partial };
  await setAppSettings(next);
  notifyAppSettingsSnapshot(next);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  heightUnit: 'cm',
  weightUnit: 'kg',
  bodyWeightUnit: 'kg',
  workoutSoundsEnabled: true,
  profile: {},
  isLoading: true,

  load: async () => {
    try {
      const [systemStored, legacyWeight, heightRaw, exerciseStored, bodyStored] = await Promise.all([
        AsyncStorage.getItem(UNIT_SYSTEM_KEY),
        AsyncStorage.getItem(WEIGHT_UNIT_KEY_LEGACY),
        AsyncStorage.getItem(HEIGHT_UNIT_KEY),
        AsyncStorage.getItem(EXERCISE_WEIGHT_UNIT_KEY),
        AsyncStorage.getItem(BODY_WEIGHT_UNIT_KEY),
      ]);

      if (!systemStored && (legacyWeight === 'lb' || heightRaw === 'in')) {
        await AsyncStorage.setItem(UNIT_SYSTEM_KEY, 'imperial');
      }

      const settings = await getAppSettings();

      const needsPersist =
        heightRaw == null || exerciseStored == null || bodyStored == null;
      if (needsPersist) {
        await setAppSettings(settings);
      }

      set({
        heightUnit: settings.heightUnit,
        weightUnit: settings.weightUnit,
        bodyWeightUnit: settings.bodyWeightUnit,
        workoutSoundsEnabled: settings.workoutSoundsEnabled,
        profile: settings.profile,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setHeightUnit: async (heightUnit) => {
    set({ heightUnit });
    await persistAndNotify({ heightUnit });
  },

  setWeightUnit: async (weightUnit) => {
    set({ weightUnit });
    await persistAndNotify({ weightUnit });
  },

  setBodyWeightUnit: async (bodyWeightUnit) => {
    set({ bodyWeightUnit });
    await persistAndNotify({ bodyWeightUnit });
  },

  setWorkoutSoundsEnabled: async (workoutSoundsEnabled) => {
    set({ workoutSoundsEnabled });
    await persistAndNotify({ workoutSoundsEnabled });
  },

  setProfile: async (profile) => {
    set({ profile });
    await persistAndNotify({ profile });
  },

  setNotNatty: async (notNatty) => {
    const profile = { ...get().profile, notNatty };
    set({ profile });
    await persistAndNotify({ profile });
  },
}));
