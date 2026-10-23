import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit } from '@/utils/weightUnits';
import {
  APP_SETTINGS_KEYS,
  getAppSettings,
  legacyUnitMigration,
  parseActiveProgramId,
  parseStoredAppSettings,
  readStoredAppSettingsValues,
  setAppSettings,
  settingsNeedPersist,
  type UserAppProfile,
  type SyncedAppSettings,
  type ThemePreference,
} from '@/storage/localStorage';
import { notifyAppSettingsSnapshot } from '@/sync';
import { DEFAULT_REST_SECONDS, storedRestSeconds } from '@/utils/templateExercises';

export type { UserAppProfile, SyncedAppSettings, ThemePreference };

export interface SettingsState {
  /** Exercise loads: workouts, PRs, templates */
  weightUnit: WeightUnit;
  /** Profile body weight display */
  bodyWeightUnit: WeightUnit;
  /** Beeps during active workout (rest countdown, set done, workout finished) */
  workoutSoundsEnabled: boolean;
  profile: UserAppProfile;
  /** The built-in program in Your workouts (a built-in folder id); null = no program. */
  activeProgramId: string | null;
  /** Work-set rest for every exercise that doesn't set its own; 2:00 unless changed. */
  defaultRestSeconds: number;
  isLoading: boolean;
  load: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setBodyWeightUnit: (unit: WeightUnit) => Promise<void>;
  setWorkoutSoundsEnabled: (enabled: boolean) => Promise<void>;
  setProfile: (profile: UserAppProfile) => Promise<void>;
  /** Put a program in Your workouts (replacing any other), or pass null to remove it. */
  setActiveProgram: (programId: string | null) => Promise<void>;
  setDefaultRestSeconds: (seconds: number) => Promise<void>;
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
  weightUnit: 'lb',
  bodyWeightUnit: 'lb',
  workoutSoundsEnabled: true,
  profile: {},
  activeProgramId: null,
  defaultRestSeconds: DEFAULT_REST_SECONDS,
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
        weightUnit: settings.weightUnit,
        bodyWeightUnit: settings.bodyWeightUnit,
        workoutSoundsEnabled: settings.workoutSoundsEnabled,
        profile: settings.profile,
        activeProgramId: settings.activeProgramId,
        defaultRestSeconds: settings.defaultRestSeconds,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
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

  setActiveProgram: async (programId) => {
    const activeProgramId = parseActiveProgramId(programId);
    set({ activeProgramId });
    await persistAndNotify({ activeProgramId });
  },

  setDefaultRestSeconds: async (seconds) => {
    const defaultRestSeconds = storedRestSeconds(seconds);
    set({ defaultRestSeconds });
    await persistAndNotify({ defaultRestSeconds });
  },
}));
