import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import HistoryScreen from '../../../../app/(tabs)/history';
import EditSessionScreen from '../../../../app/edit-session';
import { getSessions } from '@/storage/localStorage';
import { useAuthStore } from '@/store/authStore';
import { resetAppState, routeStub } from '../render';
import { ex, finishedSession, renderAt, resetHistoryStores, restoreNow, seedSessions } from './helpers';

/** docs/features/history-analytics.md#editing-a-session */

jest.mock('@/sync', () => ({
  ...jest.requireActual('@/sync'),
  syncNow: jest.fn(async () => undefined),
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
}));
const sync = jest.requireMock('@/sync') as { notifySessionUpsert: jest.Mock };

const NOW = new Date(2026, 8, 16, 12);
// A typo'd 800 kg squat, logged yesterday, plus a set that was never completed.
const LEGS = finishedSession('legs', new Date(2026, 8, 15, 10), [ex('squat', [5, 800], [5, 100])], 'ppl-legs', 45);
LEGS.exercises[0].sets.push({ completed: false, reps: 5, weightKg: 100 });

const routes = {
  '(tabs)/history': HistoryScreen,
  'edit-session': EditSessionScreen,
  'personal-records': routeStub('personal-records'),
  'history-monthly': routeStub('history-monthly'),
  'exercise-progression': routeStub('exercise-progression'),
};

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const saveState = () => screen.getByTestId('edit-session-save').props.accessibilityState;

async function openEditor() {
  await seedSessions([LEGS]);
  const result = renderAt(NOW, routes, '/history');
  fireEvent.press(await screen.findByLabelText('Edit Legs'));
  await screen.findByText('Edit workout');
  return result;
}

beforeEach(async () => {
  await resetAppState();
  resetHistoryStores();
  useAuthStore.setState({ isAnonymous: true });
  jest.clearAllMocks();
});

afterEach(restoreNow);

test('opens a form of the completed sets: values and delete, no done ticks', async () => {
  const r = await openEditor();
  expect(r.getPathname()).toBe('/edit-session');
  expect(screen.getByText('Legs')).toBeTruthy();
  expect(screen.getByText('Tue, Sep 15')).toBeTruthy();
  expect(screen.getByTestId('edit-set-0-1')).toBeTruthy();
  expect(screen.queryByTestId('edit-set-0-2')).toBeNull();
  expect(screen.queryByTestId('set-done-0-0')).toBeNull();
  expect(saveState()).toEqual({ disabled: true });
});

test('fixing a weight and saving updates the session in place and returns to History', async () => {
  const r = await openEditor();
  press('edit-weight-0-0');
  press('keypad-key-8');
  press('keypad-key-0');
  expect(saveState()).toEqual({ disabled: false });
  press('edit-session-save');

  await waitFor(() => expect(r.getPathname()).toBe('/history'));
  const [saved] = await getSessions();
  expect(saved.exercises[0].sets).toEqual([
    { completed: true, reps: 5, weightKg: 80 },
    { completed: true, reps: 5, weightKg: 100 },
  ]);
  expect(saved.completedAt).toBe(LEGS.completedAt);
  expect(saved.editedAt).toBeDefined();
  expect(sync.notifySessionUpsert).toHaveBeenCalledWith(saved);
  expect(await screen.findByText('45m · 900 kg')).toBeTruthy();
});

test('deleting a set removes it; deleting every set blocks Save with a hint', async () => {
  await openEditor();
  press('edit-delete-0-0');
  expect(screen.queryByTestId('edit-set-0-1')).toBeNull();
  expect(saveState()).toEqual({ disabled: false });
  press('edit-delete-0-0');
  expect(screen.getByTestId('edit-session-problem').props.children).toBe(
    'A workout needs at least one set. To remove it, delete it from History.'
  );
  expect(saveState()).toEqual({ disabled: true });
});

test('clearing reps blocks Save', async () => {
  await openEditor();
  press('edit-reps-0-0');
  press('keypad-backspace');
  expect(screen.getByText('Every set needs reps.')).toBeTruthy();
  expect(saveState()).toEqual({ disabled: true });
});

test('Cancel with changes asks first, then leaves History as it was', async () => {
  const r = await openEditor();
  press('edit-delete-0-0');
  press('edit-session-cancel');
  expect(await screen.findByText('Discard changes?')).toBeTruthy();
  press('edit-session-discard');
  await waitFor(() => expect(r.getPathname()).toBe('/history'));
  expect(await getSessions()).toEqual([LEGS]);
});

test('Cancel with no changes just goes back', async () => {
  const r = await openEditor();
  press('edit-session-cancel');
  await waitFor(() => expect(r.getPathname()).toBe('/history'));
  expect(screen.queryByText('Discard changes?')).toBeNull();
});
