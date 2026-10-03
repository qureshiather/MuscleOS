import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit, HeightUnit } from '@/utils/weightUnits';
import {
  APP_SETTINGS_KEYS,
  getAppSettings,
  legacyUnitMigration,
  parseStoredAppSettings,
  readStoredAppSettingsValues,
  setAppSettings,
  settingsNeedPersist,
  type UserAppProfile,
  type SyncedAppSettings,
  type ThemePreference,
} from '@/storage/localStorage';
import { notifyAppSettingsSnapshot } from '@/sync';

export type { UserAppProfile, SyncedAppSettings, ThemePreference };

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

let settingsWrites: Promise<unknown> = Promise.resolve();

/**
 * Read-modify-write of the settings keys, one at a time so quick taps don't drop a change. Every
 * writer of app settings (this store and the theme picker) goes through here.
 */
export function persistAndNotify(partial: Partial<SyncedAppSettings>): Promise<void> {
  const write = async () => {
    const current = await getAppSettings();
    const next: SyncedAppSettings = { ...current, ...partial };
    await setAppSettings(next);
    notifyAppSettingsSnapshot(next);
  };
  const run = settingsWrites.then(write, write);
  settingsWrites = run.catch(() => undefined);
  return run;
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
      const raw = await readStoredAppSettingsValues();
      const unitSystem = legacyUnitMigration(raw);
      if (unitSystem) {
        await AsyncStorage.setItem(APP_SETTINGS_KEYS.unitSystem, unitSystem);
      }
      const settings = parseStoredAppSettings({ ...raw, unitSystem: unitSystem ?? raw.unitSystem });
      if (settingsNeedPersist(raw)) {
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
}));
