import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { useExercisesStore } from '@/store/exercisesStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { resetAppState, setPro } from '../render';
import { exercise, renderExercises, seedExercises } from './helpers';

jest.mock('@/sync', () => ({
  notifyCustomExerciseUpsert: jest.fn(),
  notifyCustomExerciseDelete: jest.fn(),
  notifyExerciseNotesSnapshot: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  syncAfterWorkout: jest.fn(),
}));
jest.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: jest.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));

const CUSTOM = exercise('custom_3', 'Landmine Press', {
  muscles: ['front_delts'],
  equipment: [],
  instructions: 'Press up and out.',
});

beforeEach(async () => {
  await resetAppState();
  seedExercises([CUSTOM]);
});

/** Start on the Exercises tab, then open the form so router.back() has somewhere to go. */
async function openForm(href: Parameters<typeof router.push>[0]) {
  const utils = renderExercises();
  await screen.findByText('Exercises');
  act(() => router.push(href));
  return utils;
}

function savedCustoms() {
  return useExercisesStore.getState().customExercises;
}

describe('create-exercise gate', () => {
  it('redirects Basic users who reach the route directly to the paywall', async () => {
    // Mounting the gated route as the very first screen trips expo-router's "navigate before the
    // root layout mounted" guard in the test renderer, so open it on top of the tab instead.
    const { getPathname, getSearchParams } = await openForm({
      pathname: '/create-exercise',
      params: { id: 'custom_3' },
    });
    await waitFor(() => expect(getPathname()).toBe('/subscription'));
    expect(getSearchParams()).toMatchObject({ feature: 'custom_exercises' });
    expect(screen.queryByText('New exercise')).toBeNull();
  });
});

describe('create-exercise form', () => {
  beforeEach(() => setPro(true));

  it('does not save until name, Type and a muscle are set', async () => {
    await openForm('/create-exercise');
    expect(await screen.findByText('New exercise')).toBeTruthy();
    expect(screen.getByText('Equipment · optional')).toBeTruthy();

    fireEvent.press(screen.getByText('Save exercise'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Cable row'), '   ');
    fireEvent.press(screen.getAllByText('Cable')[0]);
    fireEvent.press(screen.getByText('Lats'));
    fireEvent.press(screen.getByText('Save exercise'));
    await act(async () => {});
    expect(savedCustoms()).toHaveLength(1);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Cable row'), 'Cable Row');
    fireEvent.press(screen.getByText('Lats')); // deselect: no muscles
    expect(screen.getByText('Muscles · 0')).toBeTruthy();
    fireEvent.press(screen.getByText('Save exercise'));
    await act(async () => {});
    expect(savedCustoms()).toHaveLength(1);
  });

  it('saves a trimmed custom as custom_<highest+1> and goes back', async () => {
    const { getPathname } = await openForm('/create-exercise');
    fireEvent.changeText(await screen.findByPlaceholderText('e.g. Cable row'), '  Seated Cable Row ');
    fireEvent.press(screen.getAllByText('Cable')[0]);
    fireEvent.press(screen.getByText('Lats'));
    fireEvent.press(screen.getByText('Rhomboids'));
    expect(screen.getByText('Muscles · 2')).toBeTruthy();
    fireEvent.press(screen.getByText('Save exercise'));

    await waitFor(() => expect(savedCustoms()).toHaveLength(2));
    expect(savedCustoms()[1]).toMatchObject({
      id: 'custom_4',
      name: 'Seated Cable Row',
      category: 'cable',
      muscles: ['lats', 'rhomboids'],
      equipment: [],
      trackingType: 'weight_reps',
    });
    expect(savedCustoms()[1].instructions).toBeUndefined();
    await waitFor(() => expect(getPathname()).toBe('/exercises'));
  });

  it('a catalog id deep link opens an empty create form and never clones the catalog row', async () => {
    await openForm({ pathname: '/create-exercise', params: { id: 'bench-press' } });
    expect(await screen.findByText('New exercise')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. Cable row').props.value).toBe('');
    expect(screen.getByText('Muscles · 0')).toBeTruthy();
    fireEvent.press(screen.getByText('Save exercise'));
    await act(async () => {});
    expect(savedCustoms()).toEqual([CUSTOM]);
  });

  it('edits a custom in place, and blank instructions clear them', async () => {
    const { getPathname } = await openForm({
      pathname: '/create-exercise',
      params: { id: 'custom_3' },
    });
    expect(await screen.findByText('Edit exercise')).toBeTruthy();
    expect(screen.getByDisplayValue('Press up and out.')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('Landmine Press'), 'Half-Kneeling Landmine Press');
    fireEvent.changeText(screen.getByDisplayValue('Press up and out.'), '  ');
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(savedCustoms()[0].name).toBe('Half-Kneeling Landmine Press'));
    expect(savedCustoms()).toHaveLength(1);
    expect(savedCustoms()[0].id).toBe('custom_3');
    expect(savedCustoms()[0].instructions).toBeUndefined();
    await waitFor(() => expect(getPathname()).toBe('/exercises'));
  });
});

describe('created from the active-workout picker', () => {
  beforeEach(() => setPro(true));

  async function fillAndSave() {
    fireEvent.changeText(await screen.findByPlaceholderText('e.g. Cable row'), 'Sled Push');
    fireEvent.press(screen.getByText('Free Weight'));
    fireEvent.press(screen.getByText('Quads'));
    fireEvent.press(screen.getByText('Save exercise'));
    await waitFor(() => expect(savedCustoms()).toHaveLength(2));
  }

  it('adds the new exercise to the live workout', async () => {
    const addExercise = jest.fn();
    useActiveWorkoutStore.setState({ addExercise });
    await openForm({
      pathname: '/create-exercise',
      params: { name: 'Sled', origin: 'active-workout', workoutMode: 'add' },
    });
    await fillAndSave();
    expect(addExercise).toHaveBeenCalledWith('custom_4');
  });

  it('swaps it in for the exercise being replaced', async () => {
    const replaceExercise = jest.fn();
    useActiveWorkoutStore.setState({ replaceExercise });
    await openForm({
      pathname: '/create-exercise',
      params: { origin: 'active-workout', workoutMode: 'replace', workoutExIdx: '2' },
    });
    await fillAndSave();
    expect(replaceExercise).toHaveBeenCalledWith(2, 'custom_4');
  });
});
