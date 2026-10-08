import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { APP_SETTINGS_KEYS, getAppSettings } from '@/storage/localStorage';

/**
 * docs/features/accounts-and-data.md#settings — settingsStore load (legacy migration, write-back)
 * and that every change persists and is offered to sync.
 */

const notifyAppSettingsSnapshot = vi.hoisted(() => vi.fn());
vi.mock('@/sync', () => ({ notifyAppSettingsSnapshot }));

const { persistAndNotify, useSettingsStore } = await import('./settingsStore');

beforeEach(() => {
  __resetAsyncStorage();
  notifyAppSettingsSnapshot.mockClear();
});

describe('settingsStore.load', () => {
  it('first launch: metric defaults, sounds on, and the defaults are written back', async () => {
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState()).toMatchObject({
      weightUnit: 'kg',
      bodyWeightUnit: 'kg',
      workoutSoundsEnabled: true,
      profile: {},
      isLoading: false,
    });
    expect(await AsyncStorage.getItem(APP_SETTINGS_KEYS.exerciseWeightUnit)).toBe('kg');
    expect(notifyAppSettingsSnapshot).not.toHaveBeenCalled();
  });

  it('migrates an older lb preference to unit_system imperial', async () => {
    await AsyncStorage.setItem(APP_SETTINGS_KEYS.weightUnitLegacy, 'lb');
    await useSettingsStore.getState().load();
    expect(await AsyncStorage.getItem(APP_SETTINGS_KEYS.unitSystem)).toBe('imperial');
    expect(useSettingsStore.getState()).toMatchObject({ weightUnit: 'lb', bodyWeightUnit: 'lb' });
  });
});

describe('settingsStore setters', () => {
  it('each change persists and notifies sync with the whole snapshot', async () => {
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().setWeightUnit('lb');
    await useSettingsStore.getState().setBodyWeightUnit('kg');
    await useSettingsStore.getState().setWorkoutSoundsEnabled(false);
    await useSettingsStore.getState().setProfile({ weightKg: 80 });
    expect(await getAppSettings()).toMatchObject({
      weightUnit: 'lb',
      bodyWeightUnit: 'kg',
      workoutSoundsEnabled: false,
      profile: { weightKg: 80 },
    });
    expect(notifyAppSettingsSnapshot).toHaveBeenCalledTimes(4);
    expect(notifyAppSettingsSnapshot.mock.calls.at(-1)?.[0]).toMatchObject({ themePreference: 'auto', profile: { weightKg: 80 } });
  });
});

describe('shared settings write queue', () => {
  it('a theme change at the same moment as a unit change keeps both', async () => {
    await useSettingsStore.getState().load();
    // The theme picker (ThemeContext.setTheme) writes through persistAndNotify too.
    await Promise.all([
      persistAndNotify({ themePreference: 'dark' }),
      useSettingsStore.getState().setWeightUnit('lb'),
      useSettingsStore.getState().setWorkoutSoundsEnabled(false),
    ]);
    expect(await getAppSettings()).toMatchObject({
      themePreference: 'dark',
      weightUnit: 'lb',
      workoutSoundsEnabled: false,
    });
    expect(notifyAppSettingsSnapshot.mock.calls.at(-1)?.[0]).toMatchObject({
      themePreference: 'dark',
      weightUnit: 'lb',
      workoutSoundsEnabled: false,
    });
  });
});
