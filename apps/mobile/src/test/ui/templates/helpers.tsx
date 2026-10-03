/**
 * Shared seeding for the templates / home screen tests. Stores are module singletons in Jest, so
 * every test resets them and seeds through AsyncStorage (which the screens load from on mount).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TemplateFolder, WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import { STORAGE_KEYS } from '@/storage/keys';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { type Routes, renderApp, resetAppState } from '../render';

/** Wednesday 4 March 2026, 12:00 UTC — every test's "now". */
export const NOW = Date.parse('2026-03-04T12:00:00.000Z');
export const DAY = 24 * 60 * 60 * 1000;

/**
 * `renderRouter` switches Jest to fake timers starting at the real clock, so pin "now" right after
 * it. Everything time-based on these screens derives from sessions/previous values, which load
 * asynchronously after mount and so are computed against `NOW`.
 */
export function renderAtNow(routes: Routes, initialUrl = '/') {
  const result = renderApp(routes, initialUrl);
  jest.setSystemTime(NOW);
  current = result;
  return result;
}

let current: ReturnType<typeof renderApp> | null = null;

/** Current route of the last `renderAtNow` (expo-router's own matchers ship without types). */
export function pathname(): string {
  if (!current) throw new Error('renderAtNow() first');
  return current.getPathname();
}

export function searchParams(): Record<string, string | string[]> {
  if (!current) throw new Error('renderAtNow() first');
  return current.getSearchParams();
}

export async function resetTemplatesTestState(): Promise<void> {
  await resetAppState();
  useTemplatesStore.setState({
    userTemplates: [],
    folders: [],
    hiddenBuiltInIds: [],
    hiddenBuiltInFolderIds: [],
    isLoading: true,
  });
  useSessionsStore.setState({ sessions: [], isLoading: true });
  useRecoveryStore.setState({ items: [], isLoading: true, hasLoaded: false });
  useActiveWorkoutStore.setState({ session: null });
}

export function customTemplate(over: Partial<WorkoutTemplate> & { id: string }): WorkoutTemplate {
  return { name: over.id, exerciseIds: ['bench-press', 'squat'], isBuiltIn: false, ...over };
}

export function completedSession(
  templateId: string,
  completedAt: number,
  exerciseIds: string[] = ['bench-press']
): WorkoutSession {
  return {
    id: `session_${templateId}_${completedAt}`,
    templateId,
    startedAt: new Date(completedAt - 60 * 60 * 1000).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({
      exerciseId,
      sets: [{ completed: true, reps: 5, weightKg: 60 }],
    })),
  };
}

export async function seed(data: {
  templates?: WorkoutTemplate[];
  folders?: TemplateFolder[];
  sessions?: WorkoutSession[];
  hiddenBuiltInIds?: string[];
  hiddenBuiltInFolderIds?: string[];
  previous?: Record<string, { weightKg: number; reps?: number }>;
}): Promise<void> {
  const pairs: [string, unknown][] = [
    [STORAGE_KEYS.templates, data.templates],
    [STORAGE_KEYS.templateFolders, data.folders],
    [STORAGE_KEYS.sessions, data.sessions],
    [STORAGE_KEYS.hiddenBuiltInTemplateIds, data.hiddenBuiltInIds],
    [STORAGE_KEYS.hiddenBuiltInFolderIds, data.hiddenBuiltInFolderIds],
    [STORAGE_KEYS.exercisePrevious, data.previous],
  ];
  for (const [key, value] of pairs) {
    if (value !== undefined) await AsyncStorage.setItem(key, JSON.stringify(value));
  }
}

export async function storedTemplates(): Promise<WorkoutTemplate[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.templates);
  return raw ? JSON.parse(raw) : [];
}

/** A minimal in-progress session for the "Workout in progress" guards. */
export function startActiveSession(templateId = 'ppl-push'): void {
  useActiveWorkoutStore.setState({
    session: {
      id: 'active_1',
      templateId,
      startedAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
      exercises: [{ exerciseId: 'bench-press', sets: [{ completed: false }] }],
    },
  });
}
