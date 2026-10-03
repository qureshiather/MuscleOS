import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { STORAGE_KEYS } from './keys';
import {
  APP_SETTINGS_KEYS,
  CLEAR_ALL_DATA_KEPT_KEYS,
  CLEAR_ALL_DATA_KEYS,
  buildExportData,
  clearAllData,
  defaultAppSettings,
  getAppSettings,
  getSubscription,
  getTemplates,
  legacyUnitMigration,
  normalizeAppSettings,
  onThemeStorageChanged,
  parseStoredAppSettings,
  setAppSettings,
  settingsNeedPersist,
  type StoredAppSettingsValues,
} from './localStorage';

/**
 * docs/features/accounts-and-data.md — settings defaults and persistence, migrations, Clear all
 * data, and the export payload.
 */

const blank: StoredAppSettingsValues = {
  unitSystem: null,
  profile: null,
  weightUnitLegacy: null,
  heightUnit: null,
  exerciseWeightUnit: null,
  bodyWeightUnit: null,
  workoutSounds: null,
  theme: null,
};

beforeEach(() => __resetAsyncStorage());

describe('settings defaults and fallbacks', () => {
  it('defaults to cm, kg, kg, sounds on, theme Auto, empty biodata', () => {
    expect(parseStoredAppSettings(blank)).toEqual({
      heightUnit: 'cm',
      weightUnit: 'kg',
      bodyWeightUnit: 'kg',
      workoutSoundsEnabled: true,
      themePreference: 'auto',
      profile: {},
    });
    expect(defaultAppSettings()).toEqual(parseStoredAppSettings(blank));
  });

  it('unset units default from unit_system: imperial', () => {
    expect(parseStoredAppSettings({ ...blank, unitSystem: 'imperial' })).toMatchObject({
      heightUnit: 'in',
      weightUnit: 'lb',
      bodyWeightUnit: 'lb',
    });
  });

  it('the three units are independent once stored', () => {
    expect(
      parseStoredAppSettings({ ...blank, heightUnit: 'in', exerciseWeightUnit: 'kg', bodyWeightUnit: 'lb' })
    ).toMatchObject({ heightUnit: 'in', weightUnit: 'kg', bodyWeightUnit: 'lb' });
  });

  it('exercise weight falls back to the legacy single unit; body weight follows exercise weight', () => {
    expect(parseStoredAppSettings({ ...blank, weightUnitLegacy: 'lb' })).toMatchObject({
      weightUnit: 'lb',
      bodyWeightUnit: 'lb',
    });
  });

  it('junk values fall back; sounds off only for 0/false', () => {
    const s = parseStoredAppSettings({ ...blank, heightUnit: 'ft', theme: 'blue', workoutSounds: 'maybe', profile: '{bad' });
    expect(s).toMatchObject({ heightUnit: 'cm', themePreference: 'auto', workoutSoundsEnabled: true, profile: {} });
    expect(parseStoredAppSettings({ ...blank, workoutSounds: '0' }).workoutSoundsEnabled).toBe(false);
    expect(parseStoredAppSettings({ ...blank, workoutSounds: 'false' }).workoutSoundsEnabled).toBe(false);
  });

  it('persists and reads back every synced setting (theme included)', async () => {
    const settings = {
      heightUnit: 'in' as const,
      weightUnit: 'lb' as const,
      bodyWeightUnit: 'kg' as const,
      workoutSoundsEnabled: false,
      themePreference: 'dark' as const,
      profile: { age: 30, sex: 'female' as const },
    };
    await setAppSettings(settings);
    expect(await getAppSettings()).toEqual(settings);
    expect(await AsyncStorage.getItem(APP_SETTINGS_KEYS.workoutSounds)).toBe('0');
    expect(await AsyncStorage.getItem(APP_SETTINGS_KEYS.unitSystem)).toBeNull();
  });

  it('notifies theme listeners on every settings write and on Clear all data', async () => {
    const listener = vi.fn();
    const off = onThemeStorageChanged(listener);
    await setAppSettings(defaultAppSettings());
    await clearAllData();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    await setAppSettings(defaultAppSettings());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('migrations', () => {
  it('legacy lb or in promotes to unit_system imperial, only when unit_system was never written', () => {
    expect(legacyUnitMigration({ unitSystem: null, weightUnitLegacy: 'lb', heightUnit: null })).toBe('imperial');
    expect(legacyUnitMigration({ unitSystem: null, weightUnitLegacy: null, heightUnit: 'in' })).toBe('imperial');
    expect(legacyUnitMigration({ unitSystem: null, weightUnitLegacy: 'kg', heightUnit: 'cm' })).toBeNull();
    expect(legacyUnitMigration({ unitSystem: 'metric', weightUnitLegacy: 'lb', heightUnit: null })).toBeNull();
  });

  it('settings are written back while any unit key is unset', () => {
    expect(settingsNeedPersist({ heightUnit: null, exerciseWeightUnit: 'kg', bodyWeightUnit: 'kg' })).toBe(true);
    expect(settingsNeedPersist({ heightUnit: 'cm', exerciseWeightUnit: 'kg', bodyWeightUnit: 'kg' })).toBe(false);
  });

  it('remote app_settings missing themePreference (or with junk) normalise to the fallback', () => {
    expect(normalizeAppSettings({ heightUnit: 'in' } as never).themePreference).toBe('auto');
    expect(normalizeAppSettings({ weightUnit: 'stone' } as never).weightUnit).toBe('kg');
    expect(normalizeAppSettings(null)).toEqual(defaultAppSettings());
  });

  it('any persisted subscription tier other than pro reads as basic', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify({ tier: 'premium', plan: 'annual' }));
    expect((await getSubscription())?.tier).toBe('basic');
    await AsyncStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify({ tier: 'pro' }));
    expect((await getSubscription())?.tier).toBe('pro');
    await AsyncStorage.setItem(STORAGE_KEYS.subscription, 'nope');
    expect(await getSubscription()).toBeNull();
  });

  it('templates with days[] flatten to exerciseIds and are written back', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.templates,
      JSON.stringify([{ id: 't1', name: 'Old', days: [{ exerciseIds: ['bench-press', 'squat'], defaultSets: 4 }] }])
    );
    const [t] = await getTemplates();
    expect(t.exerciseIds).toEqual(['bench-press', 'squat']);
    expect(t).not.toHaveProperty('days');
    expect(t).not.toHaveProperty('defaultSets');
    expect(t.exercises?.map((e) => e.sets)).toEqual([4, 4]);
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.templates)) as string);
    expect(stored[0]).not.toHaveProperty('days');
  });

  it('template defaultSets becomes per-exercise sets', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.templates,
      JSON.stringify([{ id: 't1', name: 'T', exerciseIds: ['squat'], defaultSets: 5 }])
    );
    const [t] = await getTemplates();
    expect(t.exercises?.[0]).toMatchObject({ exerciseId: 'squat', sets: 5 });
    expect(t).not.toHaveProperty('defaultSets');
  });
});

describe('clearAllData (D15)', () => {
  it('removes every app key it lists and keeps the documented ones', async () => {
    const all = [...CLEAR_ALL_DATA_KEYS, ...CLEAR_ALL_DATA_KEPT_KEYS];
    for (const key of all) await AsyncStorage.setItem(key, '1');
    await AsyncStorage.setItem('sb-project-auth-token', 'session');
    await clearAllData();
    for (const key of CLEAR_ALL_DATA_KEYS) expect(await AsyncStorage.getItem(key)).toBeNull();
    for (const key of CLEAR_ALL_DATA_KEPT_KEYS) expect(await AsyncStorage.getItem(key)).toBe('1');
    expect(await AsyncStorage.getItem('sb-project-auth-token')).toBe('session');
  });

  it('kept keys are exactly the active workout, sync transport, alarm flag and Apple code', () => {
    expect([...CLEAR_ALL_DATA_KEPT_KEYS].sort()).toEqual(
      [
        'muscleos_active_workout',
        'muscleos_apple_authorization_code',
        'muscleos_exact_alarm_prompt_shown',
        'muscleos_sync_meta',
        'muscleos_sync_outbox',
      ].sort()
    );
  });

  it('every STORAGE_KEYS and settings key is either cleared or deliberately kept', () => {
    const covered = new Set<string>([...CLEAR_ALL_DATA_KEYS, ...CLEAR_ALL_DATA_KEPT_KEYS]);
    for (const key of [...Object.values(STORAGE_KEYS), ...Object.values(APP_SETTINGS_KEYS)]) {
      expect(covered.has(key), key).toBe(true);
    }
  });

  it('settings read back as defaults (theme Auto) after clearing', async () => {
    await setAppSettings({ ...defaultAppSettings(), themePreference: 'dark', weightUnit: 'lb' });
    await clearAllData();
    expect(await getAppSettings()).toEqual(defaultAppSettings());
  });
});

describe('buildExportData', () => {
  it('includes version 1, account profile, subscription, workouts, templates, recovery, notes, customs, health', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify([{ id: 's1', exercises: [] }]));
    await AsyncStorage.setItem(STORAGE_KEYS.templates, JSON.stringify([{ id: 't1', name: 'T', exerciseIds: [] }]));
    await AsyncStorage.setItem(STORAGE_KEYS.templateFolders, JSON.stringify([{ id: 'f1', name: 'F' }]));
    await AsyncStorage.setItem(STORAGE_KEYS.recovery, JSON.stringify([{ muscleId: 'chest', trainedAt: 'x' }]));
    await AsyncStorage.setItem(STORAGE_KEYS.exerciseNotes, JSON.stringify({ squat: 'Low bar' }));
    await AsyncStorage.setItem(STORAGE_KEYS.customExercises, JSON.stringify([{ id: 'c1', name: 'Mine' }]));
    await AsyncStorage.setItem(STORAGE_KEYS.health, JSON.stringify({ macroTargets: { caloriesKcal: 2000 } }));
    await AsyncStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify({ tier: 'pro' }));
    const data = await buildExportData({ id: 'u1', accountId: 'u1', email: 'a@b.c' } as never);
    expect(data.version).toBe(1);
    expect(typeof data.exportedAt).toBe('string');
    expect(data.profile).toMatchObject({ email: 'a@b.c' });
    expect(data.subscription?.tier).toBe('pro');
    expect(data.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(data.templates.map((t) => t.id)).toEqual(['t1']);
    expect(data.templateFolders?.map((f) => f.id)).toEqual(['f1']);
    expect(data.recovery).toHaveLength(1);
    expect(data.exerciseNotes).toEqual({ squat: 'Low bar' });
    expect(data.customExercises?.map((e) => e.id)).toEqual(['c1']);
    expect(data.health).toMatchObject({ macroTargets: { caloriesKcal: 2000 } });
  });

  it('omits settings, biodata, hidden built-ins, previous, the active workout and the catalog', async () => {
    await setAppSettings({ ...defaultAppSettings(), profile: { age: 30 } });
    await AsyncStorage.setItem(STORAGE_KEYS.exercisePrevious, JSON.stringify({ squat: { weightKg: 100 } }));
    await AsyncStorage.setItem(STORAGE_KEYS.hiddenBuiltInTemplateIds, JSON.stringify(['ppl-push']));
    await AsyncStorage.setItem(STORAGE_KEYS.activeWorkout, JSON.stringify({ session: { exercises: [] } }));
    await AsyncStorage.setItem(STORAGE_KEYS.catalogExercises, JSON.stringify([{ id: 'x' }]));
    const data = (await buildExportData()) as unknown as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(
      ['exportedAt', 'profile', 'recovery', 'sessions', 'subscription', 'templates', 'version', 'templateFolders', 'exerciseNotes', 'customExercises', 'health'].sort()
    );
    expect(data.profile).toBeUndefined();
    expect(data.templateFolders).toBeUndefined();
    expect(data.exerciseNotes).toBeUndefined();
    expect(data.customExercises).toBeUndefined();
    expect(data.health).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('weightKg');
    expect(JSON.stringify(data)).not.toContain('ppl-push');
  });
});
