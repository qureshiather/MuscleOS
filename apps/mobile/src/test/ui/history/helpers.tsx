import type { SessionExercise, SetRecord, WorkoutSession } from '@muscleos/types';
import { setSessions } from '@/storage/localStorage';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { type Href, router } from 'expo-router';
import { act } from 'expo-router/testing-library';
import { renderApp, routeStub, type Routes } from '../render';

/**
 * Mount routes with the clock pinned to `now`. `renderRouter` switches Jest to fake timers itself
 * (resetting the fake clock to the real time), so the router first mounts a blank placeholder
 * route, then the clock is pinned, then it replaces into `initialUrl` — the screen under test
 * renders for the first time with the pinned clock. Move the clock later with `setNow()`;
 * `afterEach(restoreNow)` puts real timers back.
 */
export function renderAt(now: Date | number, routes: Routes, initialUrl: string) {
  const result = renderApp({ ...routes, __clock: routeStub('clock') }, '/__clock');
  jest.setSystemTime(now);
  act(() => router.replace(initialUrl as Href));
  return result;
}

export function setNow(now: Date | number): void {
  jest.setSystemTime(now);
}

export function restoreNow(): void {
  jest.useRealTimers();
}

export const HOUR = 60 * 60 * 1000;

/** Completed sets from `[reps, kg]` pairs; omit kg for bodyweight. */
export const sets = (...pairs: [number, number?][]): SetRecord[] =>
  pairs.map(([reps, weightKg]) => ({ reps, weightKg, completed: true }));

export const ex = (exerciseId: string, ...pairs: [number, number?][]): SessionExercise => ({
  exerciseId,
  sets: sets(...pairs),
});

/** A finished session lasting `minutes`, completed at `completedAt`. */
export function finishedSession(
  id: string,
  completedAt: Date,
  exercises: SessionExercise[],
  templateId = 'ppl-push',
  minutes = 59
): WorkoutSession {
  return {
    id,
    templateId,
    startedAt: new Date(completedAt.getTime() - minutes * 60_000).toISOString(),
    completedAt: completedAt.toISOString(),
    exercises,
  };
}

/** Write sessions to storage (screens load them on focus). */
export async function seedSessions(sessions: WorkoutSession[]): Promise<void> {
  await setSessions(sessions);
}

/** Reset the module-level stores this area reads so tests don't leak into each other. */
export function resetHistoryStores(): void {
  useRecoveryStore.setState({ items: [], isLoading: true, hasLoaded: false });
  useSessionsStore.setState({ sessions: [], isLoading: true });
  useSettingsStore.setState({ profile: {}, weightUnit: 'kg' });
}
