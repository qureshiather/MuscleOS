import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  WorkoutTemplate,
  TemplateFolder,
  WorkoutSession,
  MuscleRecovery,
  MacroTargets,
  MetabolismInfo,
  SubscriptionState,
  ExportData,
  UserProfile,
  Exercise,
} from '@muscleos/types';
import type { WeightUnit, HeightUnit } from '@/utils/weightUnits';
import { STORAGE_KEYS } from './keys';
import { normalizeExercise } from '@/utils/exerciseNormalize';

const APP_SETTINGS_KEYS = {
  unitSystem: 'muscleos_unit_system',
  profile: 'muscleos_profile',
  weightUnitLegacy: 'muscleos_weight_unit',
  heightUnit: 'muscleos_height_unit',
  exerciseWeightUnit: 'muscleos_exercise_weight_unit',
  bodyWeightUnit: 'muscleos_body_weight_unit',
  workoutSounds: 'muscleos_workout_sounds',
  theme: 'muscleos_theme',
} as const;

export type ThemePreference = 'auto' | 'dark' | 'light';

export interface UserAppProfile {
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: 'male' | 'female';
  /** Enhanced protocol: halves recovery estimates. */
  notNatty?: boolean;
}

/** Synced snapshot: units, sounds, theme, and biodata. */
export interface SyncedAppSettings {
  heightUnit: HeightUnit;
  weightUnit: WeightUnit;
  bodyWeightUnit: WeightUnit;
  workoutSoundsEnabled: boolean;
  themePreference: ThemePreference;
  profile: UserAppProfile;
}

const DEFAULT_APP_SETTINGS: SyncedAppSettings = {
  heightUnit: 'cm',
  weightUnit: 'kg',
  bodyWeightUnit: 'kg',
  workoutSoundsEnabled: true,
  themePreference: 'auto',
  profile: {},
};

function parseHeightUnit(s: string | null): HeightUnit | null {
  if (s === 'cm' || s === 'in') return s;
  return null;
}

function parseWeightUnit(s: string | null): WeightUnit | null {
  if (s === 'kg' || s === 'lb') return s;
  return null;
}

export function parseThemePreference(s: string | null | undefined): ThemePreference | null {
  if (s === 'auto' || s === 'dark' || s === 'light') return s;
  return null;
}

export async function getAppSettings(): Promise<SyncedAppSettings> {
  const [
    systemStored,
    profileRaw,
    legacyWeight,
    heightRaw,
    exerciseStored,
    bodyStored,
    workoutSoundsRaw,
    themeRaw,
  ] = await Promise.all([
    AsyncStorage.getItem(APP_SETTINGS_KEYS.unitSystem),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.profile),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.weightUnitLegacy),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.heightUnit),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.exerciseWeightUnit),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.bodyWeightUnit),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.workoutSounds),
    AsyncStorage.getItem(APP_SETTINGS_KEYS.theme),
  ]);

  const unitSystem = systemStored === 'imperial' ? 'imperial' : 'metric';
  const defaultHeight: HeightUnit = unitSystem === 'imperial' ? 'in' : 'cm';
  const defaultWeight: WeightUnit = unitSystem === 'imperial' ? 'lb' : 'kg';

  let profile: UserAppProfile = {};
  if (profileRaw) {
    try {
      profile = JSON.parse(profileRaw) as UserAppProfile;
    } catch {
      // ignore
    }
  }

  const heightUnit = parseHeightUnit(heightRaw) ?? defaultHeight;
  const weightUnit =
    parseWeightUnit(exerciseStored) ?? parseWeightUnit(legacyWeight) ?? defaultWeight;
  const bodyWeightUnit = parseWeightUnit(bodyStored) ?? weightUnit;

  let workoutSoundsEnabled = true;
  if (workoutSoundsRaw === '0' || workoutSoundsRaw === 'false') workoutSoundsEnabled = false;
  if (workoutSoundsRaw === '1' || workoutSoundsRaw === 'true') workoutSoundsEnabled = true;

  return {
    heightUnit,
    weightUnit,
    bodyWeightUnit,
    workoutSoundsEnabled,
    themePreference: parseThemePreference(themeRaw) ?? 'auto',
    profile,
  };
}

const themeStorageListeners = new Set<() => void>();

/** ThemeProvider subscribes so pull/merge can refresh UI after writing AsyncStorage. */
export function onThemeStorageChanged(listener: () => void): () => void {
  themeStorageListeners.add(listener);
  return () => {
    themeStorageListeners.delete(listener);
  };
}

function emitThemeStorageChanged(): void {
  themeStorageListeners.forEach((listener) => listener());
}

export async function setAppSettings(settings: SyncedAppSettings): Promise<void> {
  const themePreference = parseThemePreference(settings.themePreference) ?? 'auto';
  await AsyncStorage.multiSet([
    [APP_SETTINGS_KEYS.heightUnit, settings.heightUnit],
    [APP_SETTINGS_KEYS.exerciseWeightUnit, settings.weightUnit],
    [APP_SETTINGS_KEYS.bodyWeightUnit, settings.bodyWeightUnit],
    [APP_SETTINGS_KEYS.workoutSounds, settings.workoutSoundsEnabled ? '1' : '0'],
    [APP_SETTINGS_KEYS.theme, themePreference],
    [APP_SETTINGS_KEYS.profile, JSON.stringify(settings.profile ?? {})],
  ]);
  emitThemeStorageChanged();
}

export function defaultAppSettings(): SyncedAppSettings {
  return { ...DEFAULT_APP_SETTINGS, profile: {} };
}

/** Normalize remote/local payloads that may predate themePreference. */
export function normalizeAppSettings(
  payload: Partial<SyncedAppSettings> | null | undefined,
  fallback: SyncedAppSettings = defaultAppSettings()
): SyncedAppSettings {
  const base = { ...fallback, ...(payload ?? {}) };
  return {
    heightUnit: parseHeightUnit(base.heightUnit ?? null) ?? fallback.heightUnit,
    weightUnit: parseWeightUnit(base.weightUnit ?? null) ?? fallback.weightUnit,
    bodyWeightUnit: parseWeightUnit(base.bodyWeightUnit ?? null) ?? fallback.bodyWeightUnit,
    workoutSoundsEnabled: base.workoutSoundsEnabled ?? fallback.workoutSoundsEnabled,
    themePreference:
      parseThemePreference(base.themePreference) ?? fallback.themePreference,
    profile: base.profile ?? {},
  };
}

/** Legacy shape: template had days[] instead of exerciseIds */
function migrateTemplateFromDays(t: Record<string, unknown>): WorkoutTemplate {
  const days = t.days as Array<{ exerciseIds?: string[]; defaultSets?: number }> | undefined;
  if (days?.length) {
    const first = days[0];
    const { id, name, description, isBuiltIn, folderId, hidden } = t;
    return {
      id: id as string,
      name: name as string,
      ...(description != null && { description: description as string }),
      exerciseIds: first.exerciseIds ?? [],
      ...(first.defaultSets != null && { defaultSets: first.defaultSets }),
      ...(isBuiltIn !== undefined && { isBuiltIn: isBuiltIn as boolean }),
      ...(folderId != null && { folderId: folderId as string }),
      ...(hidden === true && { hidden: true }),
    };
  }
  return t as unknown as WorkoutTemplate;
}

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.templates);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Record<string, unknown>[];
    const migrated = list.map((t) =>
      t.days && Array.isArray(t.days) && (t.days as unknown[]).length > 0
        ? migrateTemplateFromDays(t)
        : (t as unknown as WorkoutTemplate)
    );
    const needsPersist = list.some((t) => t.days && Array.isArray(t.days));
    if (needsPersist) await setTemplates(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export async function setTemplates(templates: WorkoutTemplate[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

export async function getTemplateFolders(): Promise<TemplateFolder[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.templateFolders);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setTemplateFolders(folders: TemplateFolder[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.templateFolders, JSON.stringify(folders));
}

export async function getHiddenBuiltInTemplateIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.hiddenBuiltInTemplateIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export async function setHiddenBuiltInTemplateIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.hiddenBuiltInTemplateIds, JSON.stringify(ids));
}

export async function getSessions(): Promise<WorkoutSession[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.sessions);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setSessions(sessions: WorkoutSession[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
}

/** Snapshot of the in-progress workout, persisted so it survives process death. */
export interface PersistedActiveWorkout {
  session: WorkoutSession;
  restEndTime: number | null;
  restTotalSeconds: number;
  restAfter: { exIdx: number; setIdx: number } | null;
  restDurationsBetweenSets: Record<string, number>;
}

export async function getActiveWorkout(): Promise<PersistedActiveWorkout | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.activeWorkout);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedActiveWorkout | null;
    if (!parsed?.session?.exercises || !Array.isArray(parsed.session.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setActiveWorkout(state: PersistedActiveWorkout | null): Promise<void> {
  if (!state) {
    await AsyncStorage.removeItem(STORAGE_KEYS.activeWorkout);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.activeWorkout, JSON.stringify(state));
}

export interface ExercisePrevious {
  weightKg: number;
  reps?: number;
}

export async function getExercisePrevious(): Promise<Record<string, ExercisePrevious>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.exercisePrevious);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setExercisePrevious(prev: Record<string, ExercisePrevious>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.exercisePrevious, JSON.stringify(prev));
}

/** Personal notes keyed by exercise id (seat height, lever settings, etc.). */
export async function getExerciseNotes(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.exerciseNotes);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function setExerciseNotes(notes: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.exerciseNotes, JSON.stringify(notes));
}

export async function getCustomExercises(): Promise<Exercise[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.customExercises);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row, i) => normalizeExercise(row, `custom_${i + 1}`));
  } catch {
    return [];
  }
}

export interface CatalogCache {
  exercises: Exercise[];
  watermark: string | null;
  seedAppliedAt: string | null;
}

export async function getCatalogCache(): Promise<CatalogCache> {
  const [raw, watermark, seedAppliedAt] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.catalogExercises),
    AsyncStorage.getItem(STORAGE_KEYS.catalogWatermark),
    AsyncStorage.getItem(STORAGE_KEYS.catalogSeedAppliedAt),
  ]);
  if (!raw) {
    return { exercises: [], watermark, seedAppliedAt };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { exercises: [], watermark, seedAppliedAt };
    }
    return {
      exercises: parsed.map((row, i) => normalizeExercise(row, `catalog_${i}`)),
      watermark,
      seedAppliedAt,
    };
  } catch {
    return { exercises: [], watermark, seedAppliedAt };
  }
}

export async function setCatalogCache(cache: {
  exercises: Exercise[];
  watermark: string;
  seedAppliedAt: string;
}): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.catalogExercises, JSON.stringify(cache.exercises)),
    AsyncStorage.setItem(STORAGE_KEYS.catalogWatermark, cache.watermark),
    AsyncStorage.setItem(STORAGE_KEYS.catalogSeedAppliedAt, cache.seedAppliedAt),
  ]);
}

export async function setCustomExercises(exercises: Exercise[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.customExercises, JSON.stringify(exercises));
}

export async function getDevProOverride(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.devProOverride);
  return raw === 'true';
}

export async function setDevProOverride(value: boolean): Promise<void> {
  if (value) {
    await AsyncStorage.setItem(STORAGE_KEYS.devProOverride, 'true');
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.devProOverride);
  }
}

export async function getRecovery(): Promise<MuscleRecovery[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.recovery);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ muscleId: MuscleRecovery['muscleId']; trainedAt: string }>;
    return parsed.map(({ muscleId, trainedAt }) => ({ muscleId, trainedAt }));
  } catch {
    return [];
  }
}

export async function setRecovery(recovery: MuscleRecovery[]): Promise<void> {
  const normalized = recovery.map(({ muscleId, trainedAt }) => ({ muscleId, trainedAt }));
  await AsyncStorage.setItem(STORAGE_KEYS.recovery, JSON.stringify(normalized));
}

export interface HealthData {
  macroTargets?: MacroTargets;
  metabolism?: MetabolismInfo;
}

export async function getHealth(): Promise<HealthData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.health);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setHealth(health: HealthData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.health, JSON.stringify(health));
}

export async function getSubscription(): Promise<SubscriptionState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.subscription);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Omit<SubscriptionState, 'tier'> & { tier?: string };
    const tier: SubscriptionState['tier'] =
      parsed.tier === 'pro' ? 'pro' : 'basic';
    return { ...parsed, tier };
  } catch {
    return null;
  }
}

export async function setSubscription(state: SubscriptionState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify(state));
}

/** All AsyncStorage keys used by the app (for clear-all-data). */
const ALL_APP_KEYS = [
  STORAGE_KEYS.templates,
  STORAGE_KEYS.templateFolders,
  STORAGE_KEYS.hiddenBuiltInTemplateIds,
  STORAGE_KEYS.sessions,
  STORAGE_KEYS.recovery,
  STORAGE_KEYS.health,
  STORAGE_KEYS.subscription,
  STORAGE_KEYS.exercisePrevious,
  STORAGE_KEYS.exerciseNotes,
  STORAGE_KEYS.customExercises,
  STORAGE_KEYS.catalogExercises,
  STORAGE_KEYS.catalogWatermark,
  STORAGE_KEYS.catalogSeedAppliedAt,
  STORAGE_KEYS.devProOverride,
  APP_SETTINGS_KEYS.unitSystem,
  APP_SETTINGS_KEYS.profile,
  APP_SETTINGS_KEYS.weightUnitLegacy,
  APP_SETTINGS_KEYS.heightUnit,
  APP_SETTINGS_KEYS.exerciseWeightUnit,
  APP_SETTINGS_KEYS.bodyWeightUnit,
  APP_SETTINGS_KEYS.workoutSounds,
  APP_SETTINGS_KEYS.theme,
] as const;

/** Clears all app data from AsyncStorage: workouts, sessions, recovery, health, settings, theme. Does not clear auth (SecureStore). */
export async function clearAllData(): Promise<void> {
  await Promise.all(ALL_APP_KEYS.map((key) => AsyncStorage.removeItem(key)));
}

export async function buildExportData(profile?: UserProfile | null): Promise<ExportData> {
  const [
    templates,
    templateFolders,
    sessions,
    recovery,
    health,
    subscription,
    exerciseNotes,
    customExercises,
  ] = await Promise.all([
    getTemplates(),
    getTemplateFolders(),
    getSessions(),
    getRecovery(),
    getHealth(),
    getSubscription(),
    getExerciseNotes(),
    getCustomExercises(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ?? undefined,
    subscription: subscription ?? undefined,
    templates,
    templateFolders: templateFolders.length ? templateFolders : undefined,
    sessions,
    recovery,
    exerciseNotes: Object.keys(exerciseNotes).length ? exerciseNotes : undefined,
    customExercises: customExercises.length ? customExercises : undefined,
    health: Object.keys(health).length ? health : undefined,
  };
}
