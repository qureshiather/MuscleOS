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

test('cards show the demo poster, and the body figures for a custom exercise', async () => {
  await openPicker();
  const { useExercisesStore } = require('@/store/exercisesStore');
  act(() =>
    useExercisesStore.setState({
      customExercises: [
        { id: 'custom_1', name: 'Incline Landmine Press', muscles: ['chest'], equipment: [], category: 'free_weight' },
      ],
    })
  );
  fireEvent.press(screen.getByTestId('add-exercise'));
  search('incline');
  expect(screen.getByTestId('exercise-poster-incline-bench').props.source).toEqual({
    uri: expect.stringMatching(/\/incline-bench-(dark|light)\.webp$/),
  });
  expect(screen.getByTestId('picker-row-custom_1')).toBeTruthy();
  expect(screen.queryByTestId('exercise-poster-custom_1')).toBeNull();
});

test('+ on a row adds the exercise with 3 sets and closes the picker', async () => {
  await openPickerWith([]);
  search('incline bench');
  fireEvent.press(screen.getByTestId('picker-add-incline-bench'));
  expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(['incline-bench']);
  expect(session()?.exercises[0].sets).toHaveLength(3);
  expect(screen.queryByTestId('picker-search')).toBeNull();
});

test('tapping a row opens its details without adding; Add exercise there adds it', async () => {
  await openPickerWith([]);
  search('incline bench');
  fireEvent.press(screen.getByTestId('picker-row-incline-bench'));
  expect(screen.getByText('Main')).toBeTruthy();
  // The animated demo plays inline for catalog exercises, in place of the body figures.
  expect(await screen.findByLabelText('Animated demo of Incline Bench Press')).toBeTruthy();
  expect(session()?.exercises).toEqual([]);
  fireEvent.press(screen.getByTestId('picker-detail-back'));
  expect(screen.getByTestId('picker-search')).toBeTruthy();
  fireEvent.press(screen.getByTestId('picker-row-incline-bench'));
  fireEvent.press(screen.getByTestId('picker-detail-add'));
  expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(['incline-bench']);
});

test('muscle, type and equipment filters narrow the list and Clear filters resets them', async () => {
  await openPickerWith([]);
  const count = () => screen.getByTestId('picker-count').props.children as string;
  const all = count();
  fireEvent.press(screen.getByTestId('picker-area-legs'));
  expect(screen.queryByTestId('picker-row-bench-press')).toBeNull();
  fireEvent.press(screen.getByTestId('picker-filter-equipment'));
  fireEvent.press(screen.getByTestId('picker-equipment-barbell'));
  expect(count()).not.toBe(all);
  fireEvent.press(screen.getByTestId('picker-clear-filters'));
  expect(count()).toBe(all);
});

test('the workout picker has no coverage strip or New muscles only filter', async () => {
  await openPickerWith([]);
  expect(screen.queryByTestId('picker-coverage')).toBeNull();
  expect(screen.queryByTestId('picker-filter-new-muscles')).toBeNull();
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

test('+ New beside Done opens a blank custom-exercise builder that adds to the workout', async () => {
  const r = await openPickerWith([]);
  expect(screen.getByTestId('picker-done')).toBeTruthy();
  fireEvent.press(screen.getByTestId('picker-new-exercise'));
  await waitFor(() => expect(r.getPathname()).toBe('/create-exercise'));
  expect(r.getSearchParams()).toMatchObject({ origin: 'active-workout', workoutMode: 'add' });
  expect(r.getSearchParams().name ?? '').toBe('');
});

test('+ New prefills the search text', async () => {
  const r = await openPickerWith([]);
  search('Zercher Squat');
  fireEvent.press(screen.getByTestId('picker-new-exercise'));
  await waitFor(() => expect(r.getPathname()).toBe('/create-exercise'));
  expect(r.getSearchParams()).toMatchObject({ name: 'Zercher Squat' });
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
