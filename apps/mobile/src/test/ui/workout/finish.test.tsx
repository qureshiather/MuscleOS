import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { getSessions } from '@/storage/localStorage';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { PUSH, PUSH_URL, flush, renderWorkout, resetWorkoutState, session, startUrl } from './helpers';

/** Finish flow, cancel and the "Good work" screen (docs/features/workout-logging.md#finish-flow). */

jest.mock('@/sync', () => ({
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  syncAfterWorkout: jest.fn(async () => undefined),
}));

beforeEach(async () => {
  await resetWorkoutState();
  useTemplatesStore.setState({ userTemplates: [], isLoading: false });
});

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

async function start(url: string) {
  const r = renderWorkout(url);
  await waitFor(() => expect(session()).not.toBeNull());
  await flush();
  return r;
}

/** Log and complete the first set of exercise `exIdx` through the store. */
function logSet(exIdx = 0, setIdx = 0, weightKg = 60, reps = 5) {
  act(() => {
    const s = useActiveWorkoutStore.getState();
    s.setSetRecord(exIdx, setIdx, { weightKg, reps });
    s.toggleSetComplete(exIdx, setIdx);
  });
}

function optionLabels(): string[] {
  return ['save_as_template', 'overwrite', 'save_values', 'discard']
    .map((id) => screen.queryByTestId(`finish-option-${id}`))
    .filter((el): el is NonNullable<typeof el> => el != null)
    .map((el) => within(el).getByText(/.+/).props.children as string);
}

describe('Finish', () => {
  test('is disabled until a set is completed', async () => {
    await start(PUSH_URL);
    expect(screen.getByTestId('finish-workout').props.accessibilityState).toEqual({ disabled: true });
    press('finish-workout');
    expect(screen.queryByText('Workout summary')).toBeNull();
    logSet();
    expect(screen.getByTestId('finish-workout').props.accessibilityState).toEqual({ disabled: false });
  });
});

describe('finish modal options', () => {
  test('unchanged built-in: Save values · Discard workout, plus Back', async () => {
    await start(PUSH_URL);
    logSet();
    press('finish-workout');
    expect(screen.getByText('Workout summary')).toBeTruthy();
    expect(optionLabels()).toEqual(['Save values', 'Discard workout']);
    expect(screen.queryByText('You changed the exercises in this workout.')).toBeNull();
    press('finish-back');
    expect(screen.queryByText('Workout summary')).toBeNull();
    expect(session()).not.toBeNull();
  });

  test('changed built-in: Save as new template · Save values only · Discard workout', async () => {
    await start(startUrl('ppl-push', ['bench-press', 'overhead-press']));
    logSet();
    press('finish-workout');
    expect(optionLabels()).toEqual(['Save as new template', 'Save values only', 'Discard workout']);
  });

  test('set-count change on a built-in counts as changed', async () => {
    await start(PUSH_URL);
    act(() => useActiveWorkoutStore.getState().addSet(0));
    logSet();
    press('finish-workout');
    expect(optionLabels()).toEqual(['Save as new template', 'Save values only', 'Discard workout']);
  });

  test('empty workout: Save as template · Save values only · Discard workout', async () => {
    await start('/active-workout?templateId=_empty');
    expect(screen.getByText('Empty workout')).toBeTruthy();
    expect(screen.getByText('No exercises yet. Tap Add Exercise below to build your workout.')).toBeTruthy();
    act(() => useActiveWorkoutStore.getState().addExercise('bench-press'));
    logSet();
    press('finish-workout');
    expect(optionLabels()).toEqual(['Save as template', 'Save values only', 'Discard workout']);
  });

  test('changed custom: Save values only · Overwrite · Save as new · Discard, with the changed hint', async () => {
    useTemplatesStore.setState({
      userTemplates: [{ id: 'tpl_mine', name: 'My Push', exerciseIds: ['bench-press', 'squat'] }],
    });
    await start(startUrl('tpl_mine', ['bench-press']));
    logSet();
    press('finish-workout');
    expect(screen.getByText('You changed the exercises in this workout.')).toBeTruthy();
    expect(optionLabels()).toEqual([
      'Save as new template',
      'Overwrite this template',
      'Save values only',
      'Discard workout',
    ]);
    // presentation order follows finishSaveOptions: Save values only is the primary
    const labels = screen
      .getAllByText(/^(Save values only|Overwrite this template|Save as new template|Discard workout)$/)
      .map((t) => t.props.children);
    expect(labels).toEqual([
      'Save values only',
      'Overwrite this template',
      'Save as new template',
      'Discard workout',
    ]);
  });

  test('unchanged custom: Save values · Discard workout', async () => {
    useTemplatesStore.setState({
      userTemplates: [{ id: 'tpl_mine', name: 'My Push', exerciseIds: ['bench-press'] }],
    });
    await start(startUrl('tpl_mine', ['bench-press']));
    logSet();
    press('finish-workout');
    expect(optionLabels()).toEqual(['Save values', 'Discard workout']);
  });

  test('Save as template swaps to the name step in the same modal; Back returns to the summary', async () => {
    await start(startUrl('ppl-push', ['bench-press']));
    logSet();
    press('finish-workout');
    press('finish-option-save_as_template');
    expect(screen.getByText('Name this workout to use it again later.')).toBeTruthy();
    expect(screen.getByDisplayValue('Push')).toBeTruthy();
    fireEvent.press(screen.getByText('Back'));
    expect(screen.getByText('Workout summary')).toBeTruthy();
  });

  test('the summary lists duration and only exercises with completed sets', async () => {
    await start(startUrl('ppl-push', ['bench-press', 'overhead-press']));
    logSet(0, 0, 60, 5);
    press('finish-workout');
    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getByText('1 set · 60 × 5 reps')).toBeTruthy();
    expect(screen.queryByText('Overhead Press')).toBeTruthy(); // still in the card list behind
    const summaryRows = screen.getAllByText(/ set(s)? · /);
    expect(summaryRows).toHaveLength(1);
  });

  test('Discard workout discards without saving and leaves to the tabs', async () => {
    const r = await start(PUSH_URL);
    logSet();
    press('finish-workout');
    press('finish-option-discard');
    expect(session()).toBeNull();
    expect(await getSessions()).toEqual([]);
    await waitFor(() => expect(r.getPathname()).toBe('/'));
  });
});

describe('Good work screen', () => {
  test('Save values saves the whole session and shows the summary with Exercises and Sets counts', async () => {
    const r = await start(PUSH_URL);
    logSet(0, 0, 60, 5);
    logSet(0, 1, 62.5, 5);
    logSet(1, 0, 40, 8);
    press('finish-workout');
    press('finish-option-save_values');

    expect(await screen.findByText('Good work')).toBeTruthy();
    expect(screen.getByText(PUSH.name)).toBeTruthy();
    const stat = (label: string) =>
      within(screen.getByText(label).parent!.parent as never).getAllByText(/.+/)[0].props.children;
    expect(stat('Exercises')).toBe(2);
    expect(stat('Sets')).toBe(3);
    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getByText('2 sets')).toBeTruthy();
    expect(screen.getByText('60 kg × 5 reps  ·  62.5 kg × 5 reps')).toBeTruthy();
    expect(screen.getByText('1 set')).toBeTruthy();

    await waitFor(async () => expect(await getSessions()).toHaveLength(1));
    const [saved] = await getSessions();
    expect(saved.completedAt).toBeDefined();
    // incomplete sets are kept in the stored session
    expect(saved.exercises[0].sets).toHaveLength(3);
    expect(saved.exercises[0].sets[2].completed).toBe(false);

    press('finished-done');
    await waitFor(() => expect(r.getPathname()).toBe('/'));
  });
});

describe('Cancel workout', () => {
  test('nothing completed: no fact line; Keep workout keeps it', async () => {
    await start(PUSH_URL);
    press('cancel-workout-footer');
    expect(screen.getByText('Cancel workout?')).toBeTruthy();
    expect(screen.getByText('This workout will not be saved.')).toBeTruthy();
    expect(screen.queryByText(/ · \d+ sets?$/)).toBeNull();
    press('cancel-workout-keep');
    expect(screen.queryByText('Cancel workout?')).toBeNull();
    expect(session()).not.toBeNull();
  });

  test('with completed sets it shows elapsed time and set count; Discard workout discards', async () => {
    const r = await start(PUSH_URL);
    logSet(0, 0);
    logSet(0, 1);
    press('cancel-workout-footer');
    expect(screen.getByText(/^\d+:\d\d · 2 sets$/)).toBeTruthy();
    press('cancel-workout-discard');
    expect(session()).toBeNull();
    expect(await getSessions()).toEqual([]);
    await waitFor(() => expect(r.getPathname()).toBe('/'));
  });
});
