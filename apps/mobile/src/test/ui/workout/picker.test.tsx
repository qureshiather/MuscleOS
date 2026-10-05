import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { flush, renderWorkout, resetWorkoutState, session, startUrl } from './helpers';

/** The Add exercise picker (docs/features/workout-logging.md#mid-workout-edits). */

jest.mock('@/sync', () => ({
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  syncAfterWorkout: jest.fn(async () => undefined),
}));

beforeEach(() => resetWorkoutState());

async function openPicker() {
  const r = renderWorkout(startUrl('_empty', []));
  await waitFor(() => expect(session()).not.toBeNull());
  await flush();
  return r;
}

async function openPickerWith(exerciseIds: string[]) {
  const r = await openPicker();
  const { useActiveWorkoutStore } = require('@/store/activeWorkoutStore');
  act(() => {
    for (const id of exerciseIds) useActiveWorkoutStore.getState().addExercise(id);
  });
  fireEvent.press(screen.getByTestId('add-exercise'));
  expect(await screen.findByText('Add exercise')).toBeTruthy();
  return r;
}

const search = (q: string) => fireEvent.changeText(screen.getByTestId('picker-search'), q);

test('an empty search offers no Create row and no "No matching" text', async () => {
  await openPickerWith([]);
  expect(screen.queryByTestId('picker-create-exercise')).toBeNull();
  expect(screen.queryByText('No matching exercises')).toBeNull();
});

test('leaves out exercises already in the workout', async () => {
  await openPickerWith(['bench-press']);
  search('bench press');
  expect(screen.queryByTestId('picker-row-bench-press')).toBeNull();
  expect(screen.getByTestId('picker-row-incline-bench')).toBeTruthy();
});

test('tapping a row adds the exercise with 3 sets and closes the picker', async () => {
  await openPickerWith([]);
  search('incline bench');
  fireEvent.press(screen.getByTestId('picker-row-incline-bench'));
  expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(['incline-bench']);
  expect(session()?.exercises[0].sets).toHaveLength(3);
  expect(screen.queryByTestId('picker-search')).toBeNull();
});

test('a search with matches still offers Create "<query>"', async () => {
  await openPickerWith([]);
  search('bench');
  expect(screen.getByText('Create “bench”')).toBeTruthy();
  expect(screen.queryByText('No matching exercises')).toBeNull();
});

test('a search with no matches shows "No matching exercises" and the Create row', async () => {
  await openPickerWith([]);
  search('zzqqxx');
  expect(screen.getByText('No matching exercises')).toBeTruthy();
  expect(screen.getByText('Create “zzqqxx”')).toBeTruthy();
});

test('Create routes to the custom-exercise builder pre-filled with the query', async () => {
  const r = await openPickerWith([]);
  search('Zercher Squat');
  fireEvent.press(screen.getByTestId('picker-create-exercise'));
  await waitFor(() => expect(r.getPathname()).toBe('/create-exercise'));
  expect(r.getSearchParams()).toMatchObject({
    name: 'Zercher Squat',
    origin: 'active-workout',
    workoutMode: 'add',
  });
});
