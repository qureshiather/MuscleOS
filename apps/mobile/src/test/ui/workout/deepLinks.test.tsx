/**
 * Deep links and notification taps straight into /active-workout and /workout-preview
 * (docs/features/workout-logging.md#starting). Everything is free: any template, an empty workout
 * or an ad-hoc exercise list starts for a guest with no purchase.
 */
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import type { WorkoutTemplate } from '@muscleos/types';
import ActiveWorkoutScreen from '../../../../app/active-workout';
import WorkoutPreviewScreen from '../../../../app/workout-preview';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useAuthStore } from '@/store/authStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { createEmptySession } from '@/store/activeWorkoutLogic';
import { renderApp, resetAppState, routeStub } from '../render';

jest.mock('@/sync', () => ({
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  syncAfterWorkout: jest.fn(async () => undefined),
}));

const CUSTOM: WorkoutTemplate = {
  id: 'tpl_custom_1',
  name: 'My Push',
  isBuiltIn: false,
  exerciseIds: ['bench-press', 'lateral-raise'],
};
const pushIds = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')?.exerciseIds ?? [];
const session = () => useActiveWorkoutStore.getState().session;

async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(async () => {
  await resetAppState();
  useActiveWorkoutStore.setState({ session: null, hydrated: true });
  useTemplatesStore.setState({
    userTemplates: [],
    folders: [],
    hiddenBuiltInIds: [],
    hiddenBuiltInFolderIds: [],
    isLoading: false,
  });
  // A guest: no account, nothing bought.
  useAuthStore.setState({ isAnonymous: true });
});

function renderActive(url: string) {
  return renderApp({ 'active-workout': ActiveWorkoutScreen, '(tabs)/index': routeStub('tabs') }, url);
}

describe('/active-workout start from params', () => {
  test('a built-in template starts with its own plan when the link carries none', async () => {
    renderActive('/active-workout?templateId=ppl-push');
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.templateId).toBe('ppl-push');
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(pushIds);
  });

  test('a built-in started from the preview keeps the plan the link encodes', async () => {
    renderActive('/active-workout?templateId=ppl-push&exerciseIds=deadlift,squat&sets=4,2');
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(['deadlift', 'squat']);
    expect(session()?.exercises.map((e) => e.sets.length)).toEqual([4, 2]);
  });

  test('_empty starts an empty workout', async () => {
    const r = renderActive('/active-workout?templateId=_empty');
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.templateId).toBe('_empty');
    expect(session()?.exercises).toEqual([]);
    expect(r.getPathname()).toBe('/active-workout');
  });

  test('an unknown template id starts an ad-hoc workout from the link', async () => {
    renderActive('/active-workout?templateId=tpl_missing&exerciseIds=deadlift');
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(['deadlift']);
  });

  test('a custom template waits for templates to load, then starts', async () => {
    useTemplatesStore.setState({ userTemplates: [], isLoading: true });
    const r = renderActive(`/active-workout?templateId=${CUSTOM.id}`);
    await flush();
    expect(session()).toBeNull();
    act(() => useTemplatesStore.setState({ userTemplates: [CUSTOM], isLoading: false }));
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.templateId).toBe(CUSTOM.id);
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(CUSTOM.exerciseIds);
    expect(r.getPathname()).toBe('/active-workout');
  });

  test('a workout already in progress is untouched', async () => {
    const running = createEmptySession('ppl-push', [{ exerciseId: 'bench-press', sets: 3, warmUpSets: 0 }]);
    useActiveWorkoutStore.setState({ session: running, hydrated: true });
    renderActive(`/active-workout?templateId=${CUSTOM.id}`);
    await flush();
    expect(session()?.id).toBe(running.id);
  });
});

describe('built-in workouts can be changed mid-session', () => {
  test('Add Exercise opens the picker on a built-in workout — no alert, no "Pro" label', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderActive('/active-workout?templateId=ppl-push');
    await waitFor(() => expect(session()).not.toBeNull());
    await flush();
    expect(screen.queryByText('Pro: Add Exercise')).toBeNull();
    fireEvent.press(screen.getByTestId('add-exercise'));
    expect(await screen.findByTestId('picker-search')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});

describe('/workout-preview', () => {
  function renderPreview(url: string) {
    return renderApp(
      { 'workout-preview': WorkoutPreviewScreen, 'active-workout': routeStub('active-workout') },
      url
    );
  }

  test('a custom template previews', async () => {
    useTemplatesStore.setState({ userTemplates: [CUSTOM], isLoading: false });
    const r = renderPreview(`/workout-preview?templateId=${CUSTOM.id}&exerciseIds=bench-press`);
    expect(await screen.findByText(CUSTOM.name)).toBeTruthy();
    expect(r.getPathname()).toBe('/workout-preview');
  });

  test('Start passes the previewed plan on to the workout', async () => {
    const r = renderPreview('/workout-preview?templateId=ppl-push&exerciseIds=deadlift');
    expect(await screen.findByText('Push')).toBeTruthy();
    fireEvent.press(screen.getByText('Start'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(r.getSearchParams()).toMatchObject({ templateId: 'ppl-push', exerciseIds: 'deadlift' });
  });

  test('cold start with a workout in progress goes to /active-workout', async () => {
    const running = createEmptySession('ppl-push', [{ exerciseId: 'bench-press', sets: 3, warmUpSets: 0 }]);
    useActiveWorkoutStore.setState({ session: running, hydrated: true });
    const r = renderPreview('/workout-preview?templateId=ppl-push');
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(r.getPathname()).toBe('/active-workout');
  });
});
