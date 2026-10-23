import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import HistoryScreen from '../../../../app/(tabs)/history';
import ActiveWorkoutScreen from '../../../../app/active-workout';
import { ResumeWorkoutPill } from '@/components/ResumeWorkoutPill';
import { getSessions } from '@/storage/localStorage';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useAuthStore } from '@/store/authStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { renderApp, resetAppState, routeStub } from '../render';
import { resetWorkoutState } from '../workout/helpers';
import { ex, finishedSession, renderAt, resetHistoryStores, restoreNow, seedSessions } from './helpers';

/** docs/features/history-analytics.md#editing-a-session */

jest.mock('@/sync', () => ({
  ...jest.requireActual('@/sync'),
  syncNow: jest.fn(async () => undefined),
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  syncAfterWorkout: jest.fn(async () => undefined),
}));
const sync = jest.requireMock('@/sync') as { notifySessionUpsert: jest.Mock };

const NOW = new Date(2026, 8, 16, 12);
// A typo'd 800 kg squat, logged yesterday.
const LEGS = finishedSession('legs', new Date(2026, 8, 15, 10), [ex('squat', [5, 800], [5, 100])], 'ppl-legs', 45);

const routes = {
  '(tabs)/history': HistoryScreen,
  'active-workout': ActiveWorkoutScreen,
  'personal-records': routeStub('personal-records'),
  'history-monthly': routeStub('history-monthly'),
  'exercise-progression': routeStub('exercise-progression'),
  'create-exercise': routeStub('create-exercise'),
};

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

async function openEditor() {
  await seedSessions([LEGS]);
  const result = renderAt(NOW, routes, '/history');
  fireEvent.press(await screen.findByLabelText('Edit Legs'));
  await screen.findByTestId('save-workout-edit');
  return result;
}

beforeEach(async () => {
  await resetAppState();
  await resetWorkoutState();
  resetHistoryStores();
  useAuthStore.setState({ isAnonymous: true });
  jest.clearAllMocks();
});

afterEach(restoreNow);

test('opens the finished workout with its date, Save, no clock and no rest', async () => {
  const r = await openEditor();
  expect(r.getPathname()).toBe('/active-workout');
  expect(screen.getByTestId('workout-edit-date').props.children).toBe('Tue, Sep 15');
  expect(screen.queryByTestId('workout-elapsed')).toBeNull();
  expect(screen.queryByTestId('header-rest-start')).toBeNull();
  expect(screen.queryByTestId('rest-row-0-0')).toBeNull();
  expect(screen.getByText('Discard changes')).toBeTruthy();
});

test('fixing a weight and saving updates the session in place and returns to History', async () => {
  const r = await openEditor();
  press('set-weight-0-0');
  press('keypad-key-8');
  press('keypad-key-0');
  press('save-workout-edit');

  await waitFor(() => expect(r.getPathname()).toBe('/history'));
  const [saved] = await getSessions();
  expect(saved.exercises[0].sets.map((s) => s.weightKg)).toEqual([80, 100]);
  expect(saved.completedAt).toBe(LEGS.completedAt);
  expect(saved.editedAt).toBeDefined();
  expect(sync.notifySessionUpsert).toHaveBeenCalledWith(saved);
  expect(useActiveWorkoutStore.getState().session).toBeNull();
  expect(await screen.findByText('45m · 900 kg')).toBeTruthy();
});

test('Discard changes asks first, then leaves History as it was', async () => {
  const r = await openEditor();
  press('set-weight-0-0');
  press('keypad-key-8');
  press('cancel-workout-footer');
  expect(await screen.findByText('Discard changes?')).toBeTruthy();
  expect(screen.getByText('The workout stays as it was in History.')).toBeTruthy();
  press('cancel-workout-discard');

  await waitFor(() => expect(r.getPathname()).toBe('/history'));
  expect(await getSessions()).toEqual([LEGS]);
});

test('Save is disabled once no completed set is left', async () => {
  await openEditor();
  press('set-done-0-0');
  press('set-done-0-1');
  expect(screen.getByTestId('save-workout-edit').props.accessibilityState).toEqual({ disabled: true });
});

test('editing while a workout is running asks to resume or cancel it first', async () => {
  await seedSessions([LEGS]);
  await act(async () => {
    await useActiveWorkoutStore.getState().startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
  });
  renderAt(NOW, routes, '/history');
  fireEvent.press(await screen.findByLabelText('Edit Legs'));
  expect(await screen.findByText('Workout in progress')).toBeTruthy();
  expect(screen.getByText('Finish or cancel your current workout before editing a past one.')).toBeTruthy();

  press('edit-blocked-discard');
  await screen.findByTestId('save-workout-edit');
  expect(useActiveWorkoutStore.getState().session?.id).toBe('legs');
});

test('the resume pill names an open edit and shows no clock', async () => {
  await seedSessions([LEGS]);
  await act(async () => {
    await useSessionsStore.getState().load();
  });
  act(() => {
    useActiveWorkoutStore.getState().editSession('legs');
  });
  renderApp({ index: ResumeWorkoutPill, 'active-workout': routeStub('active-workout') }, '/');
  expect(screen.getByText('Resume editing')).toBeTruthy();
  expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
  fireEvent.press(screen.getByLabelText('Discard changes'));
  expect(useActiveWorkoutStore.getState().session).toBeNull();
});
