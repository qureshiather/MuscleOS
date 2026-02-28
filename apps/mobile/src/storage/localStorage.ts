import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  WorkoutTemplate,
  WorkoutSession,
  MuscleRecovery,
  MacroTargets,
  MetabolismInfo,
  SubscriptionState,
  ExportData,
  UserProfile,
} from '@muscleos/types';
import { STORAGE_KEYS } from './keys';

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.templates);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setTemplates(templates: WorkoutTemplate[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
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

export async function buildExportData(profile?: UserProfile | null): Promise<ExportData> {
  const [templates, sessions, recovery, health, subscription] = await Promise.all([
    getTemplates(),
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
    sessions,
    recovery,
    health: Object.keys(health).length ? health : undefined,
  };
}
