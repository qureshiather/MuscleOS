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
import { STORAGE_KEYS } from './keys';

/** Legacy shape: template had days[] instead of exerciseIds */
function migrateTemplateFromDays(t: Record<string, unknown>): WorkoutTemplate {
  const days = t.days as Array<{ exerciseIds?: string[]; defaultSets?: number }> | undefined;
  if (days?.length) {
    const first = days[0];
    const { id, name, description, isBuiltIn, folderId } = t;
    return {
      id: id as string,
      name: name as string,
      ...(description != null && { description: description as string }),
      exerciseIds: first.exerciseIds ?? [],
      ...(first.defaultSets != null && { defaultSets: first.defaultSets }),
      ...(isBuiltIn !== undefined && { isBuiltIn: isBuiltIn as boolean }),
      ...(folderId != null && { folderId: folderId as string }),
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

export async function getCustomExercises(): Promise<Exercise[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.customExercises);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
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
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setRecovery(recovery: MuscleRecovery[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.recovery, JSON.stringify(recovery));
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
    return JSON.parse(raw);
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
  STORAGE_KEYS.sessions,
  STORAGE_KEYS.recovery,
  STORAGE_KEYS.health,
  STORAGE_KEYS.subscription,
  STORAGE_KEYS.exercisePrevious,
  STORAGE_KEYS.customExercises,
  STORAGE_KEYS.devProOverride,
  'muscleos_unit_system',
  'muscleos_profile',
  'muscleos_weight_unit',
  'muscleos_height_unit',
  'muscleos_theme',
] as const;

/** Clears all app data from AsyncStorage: workouts, sessions, recovery, health, settings, theme. Does not clear auth (SecureStore). */
export async function clearAllData(): Promise<void> {
  await Promise.all(ALL_APP_KEYS.map((key) => AsyncStorage.removeItem(key)));
}

export async function buildExportData(profile?: UserProfile | null): Promise<ExportData> {
  const [templates, templateFolders, sessions, recovery, health, subscription] =
    await Promise.all([
      getTemplates(),
      getTemplateFolders(),
      getSessions(),
      getRecovery(),
      getHealth(),
      getSubscription(),
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
    health: Object.keys(health).length ? health : undefined,
  };
}
