import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { setExercisePrevious } from '@/storage/localStorage';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import {
  PUSH,
  PUSH_URL,
  flush,
  renderWorkout,
  resetWorkoutState,
  session,
  startUrl,
} from './helpers';

/** Set logging on the active workout screen (docs/features/workout-logging.md#set-logging). */

jest.mock('@/sync', () => ({
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  syncAfterWorkout: jest.fn(async () => undefined),
}));

beforeEach(() => resetWorkoutState());

async function startPush(url = PUSH_URL) {
  const r = renderWorkout(url);
  await screen.findByText('Push');
  await flush();
  return r;
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const key = (k: string) => press(`keypad-key-${k}`);
const setsOf = (exIdx: number) => session()!.exercises[exIdx].sets;

describe('starting', () => {
  test.each([
    ['Pro', true],
    ['Basic', false],
  ])('%s starts the built-in Push from route params with the template plan', async (_, pro) => {
    await resetWorkoutState({ pro });
    await startPush();
    expect(session()?.templateId).toBe('ppl-push');
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(PUSH.exerciseIds);
    // 3 working sets per exercise by default
    expect(session()?.exercises.every((e) => e.sets.length === 3)).toBe(true);
    expect(screen.getByTestId('set-row-5-2')).toBeTruthy();
  });

  test('prefills working sets from previous as ghost suggestions; PREVIOUS shows the snapshot', async () => {
    await setExercisePrevious({ 'bench-press': { weightKg: 80, reps: 6 } });
    await startPush(startUrl('ppl-push', ['bench-press'], '&warmUpSets=1'));
    await waitFor(() => expect(setsOf(0)[1].weightKg).toBe(80));
    expect(setsOf(0)[0]).toEqual({ completed: false, isWarmUp: true });
    expect(setsOf(0)[1]).toMatchObject({ reps: 6, weightPrefilled: true, repsPrefilled: true });
    // same value on every row of the exercise, warm-up included
    expect((await screen.findAllByText('80 × 6')).length).toBe(4);
  });

  test('shows the template rows: warm-ups numbered W1, working sets 1, 2, 3', async () => {
    await startPush(startUrl('ppl-push', ['bench-press'], '&warmUpSets=1'));
    expect(screen.getByLabelText(/^Set W1,/)).toBeTruthy();
    expect(screen.getByLabelText(/^Set 1,/)).toBeTruthy();
    expect(screen.getByLabelText(/^Set 2,/)).toBeTruthy();
    expect(screen.getByLabelText(/^Set 3,/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Set 4,/)).toBeNull();
  });
});

describe('number pad', () => {
  test('opens on a reps cell; typing writes reps; Done completes on the first tap and closes the pad', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    press('set-reps-0-0');
    const pad = screen.getByTestId('numeric-keypad');
    expect(within(pad).getByText('Bench Press')).toBeTruthy();
    // Done is disabled until reps > 0
    expect(screen.getByTestId('keypad-done').props.accessibilityState).toEqual({ disabled: true });
    key('8');
    expect(setsOf(0)[0].reps).toBe(8);
    expect(screen.getByTestId('keypad-value').props.children).toBe('8');

    press('keypad-done');
    expect(setsOf(0)[0].completed).toBe(true);
    expect(screen.queryByTestId('numeric-keypad')).toBeNull();
    // rest timer started for that set (default 120 s)
    expect(useActiveWorkoutStore.getState().restAfter).toEqual({ exIdx: 0, setIdx: 0 });
    expect(screen.getByTestId('header-rest-chip')).toBeTruthy();
  });

  test('weight: digits in kg, Next jumps to reps of the same set', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    press('set-weight-0-1');
    key('6');
    key('0');
    expect(setsOf(0)[1].weightKg).toBe(60);
    press('keypad-plus');
    expect(setsOf(0)[1].weightKg).toBe(60.25);
    press('keypad-backspace'); // snaps the fraction off
    expect(setsOf(0)[1].weightKg).toBe(60);
    press('keypad-next');
    key('5');
    expect(setsOf(0)[1].reps).toBe(5);
  });

  test('pounds are converted to kg on write', async () => {
    const { useSettingsStore } = require('@/store/settingsStore');
    useSettingsStore.setState({ weightUnit: 'lb' });
    await startPush(startUrl('ppl-push', ['bench-press']));
    expect(screen.getByText('LB')).toBeTruthy();
    press('set-weight-0-0');
    key('1');
    key('0');
    key('0');
    expect(setsOf(0)[0].weightKg).toBe(45.36);
  });

  test('the first digit replaces a prefilled suggestion; the next appends', async () => {
    await setExercisePrevious({ 'bench-press': { weightKg: 80, reps: 6 } });
    await startPush(startUrl('ppl-push', ['bench-press']));
    await waitFor(() => expect(setsOf(0)[0].weightPrefilled).toBe(true));
    press('set-weight-0-0');
    key('9');
    expect(setsOf(0)[0]).toMatchObject({ weightKg: 9, weightPrefilled: false });
    key('0');
    expect(setsOf(0)[0].weightKg).toBe(90);
  });
});

describe('completing sets and the rest timer', () => {
  async function startWithReps() {
    await startPush(startUrl('ppl-push', ['bench-press', 'overhead-press']));
    const s = useActiveWorkoutStore.getState();
    act(() => {
      for (const ex of [0, 1]) for (const i of [0, 1, 2]) s.setSetRecord(ex, i, { reps: 5, weightKg: 40 });
    });
  }

  test('the row Done completes on the first tap, starts rest, and a second tap un-completes', async () => {
    await startWithReps();
    expect(screen.getByTestId('finish-workout').props.accessibilityState).toEqual({ disabled: true });
    press('set-done-0-0');
    expect(setsOf(0)[0].completed).toBe(true);
    expect(screen.getByTestId('finish-workout').props.accessibilityState).toEqual({ disabled: false });
    // the rest row after that set becomes the countdown; the header shows a chip
    expect(screen.getByTestId('rest-row-0-0').props.accessibilityLabel).toBe('Rest 2:00 remaining');
    expect(screen.getByTestId('header-rest-chip').props.accessibilityLabel).toBe('Rest 2:00 remaining');
    expect(screen.getByTestId('rest-row-0-1').props.accessibilityLabel).toBe('Rest 2:00 after this set');

    press('set-done-0-0');
    expect(setsOf(0)[0].completed).toBe(false);
    expect(useActiveWorkoutStore.getState().restEndTime).toBeNull();
    expect(screen.queryByTestId('header-rest-chip')).toBeNull();
  });

  test('Done is disabled on a set with no reps', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    expect(screen.getByTestId('set-done-0-0').props.accessibilityState).toMatchObject({ disabled: true });
    press('set-done-0-0');
    expect(setsOf(0)[0].completed).toBe(false);
  });

  test('one current set across the workout; every other incomplete set is upcoming', async () => {
    await startWithReps();
    expect(screen.getByLabelText('Set 1, current')).toBeTruthy();
    expect(screen.getAllByLabelText(/, current$/)).toHaveLength(1);
    expect(screen.getAllByLabelText(/, upcoming$/)).toHaveLength(5);
    expect(screen.getByTestId('set-row-0-0').props.accessibilityState).toEqual({ selected: true });
    // the first set of the second exercise is muted, not highlighted
    expect(screen.getByTestId('set-label-1-0').props.accessibilityLabel).toBe('Set 1, upcoming');

    for (const i of [0, 1, 2]) press(`set-done-0-${i}`);
    expect(screen.getByTestId('set-label-1-0').props.accessibilityLabel).toBe('Set 1, current');
    expect(screen.getAllByLabelText(/, completed$/)).toHaveLength(3);
    expect(screen.getByLabelText('Exercise complete')).toBeTruthy();
  });

  test('header rest dialog: ±30 adjusts the running countdown, Skip records the rest taken', async () => {
    await startWithReps();
    press('set-done-0-0');
    press('header-rest-chip');
    expect(screen.getByText('Rest remaining')).toBeTruthy();
    press('rest-plus-30');
    expect(useActiveWorkoutStore.getState().restTotalSeconds).toBe(150);
    press('rest-minus-30');
    press('rest-minus-30');
    expect(useActiveWorkoutStore.getState().restTotalSeconds).toBe(90);
    press('rest-skip');
    const st = useActiveWorkoutStore.getState();
    expect(st.restEndTime).toBeNull();
    expect(st.restDurationsBetweenSets['0-0']).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('Rest remaining')).toBeNull();
    // recorded rest shows under the set number
    expect(within(screen.getByTestId('set-label-0-0')).getByText(/^\d+:\d\d$/)).toBeTruthy();
  });

  test('the rest row after a set opens the same dialog; with no countdown it is the manual picker', async () => {
    await startWithReps();
    press('rest-row-0-0');
    expect(screen.getByText('Start rest')).toBeTruthy();
    press('rest-picker-60');
    const st = useActiveWorkoutStore.getState();
    expect(st.restTotalSeconds).toBe(60);
    expect(st.restAfter).toBeNull();
    press('header-rest-chip');
    expect(screen.getByText('Rest remaining')).toBeTruthy();
  });

  test('a countdown that reaches zero records the full duration and clears', async () => {
    await startWithReps();
    press('set-done-0-0');
    act(() => {
      useActiveWorkoutStore.setState({ restEndTime: Date.now() - 10, restTotalSeconds: 120 });
    });
    await waitFor(() => expect(useActiveWorkoutStore.getState().restEndTime).toBeNull());
    expect(useActiveWorkoutStore.getState().restDurationsBetweenSets['0-0']).toBe(120);
    expect(within(screen.getByTestId('set-label-0-0')).getByText('2:00')).toBeTruthy();
  });
});

describe('adding and removing sets', () => {
  test('+ ADD SET appends a set and shows the rest preset', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    expect(screen.getByText('+ ADD SET (2:00)')).toBeTruthy();
    press('add-set-0');
    expect(setsOf(0)).toHaveLength(4);
    expect(screen.getByLabelText(/^Set 4,/)).toBeTruthy();
  });

  test('Add warm-up inserts W1 at the top without renumbering working sets', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    act(() => useActiveWorkoutStore.getState().addWarmUpSet(0));
    expect(setsOf(0)[0].isWarmUp).toBe(true);
    expect(screen.getByTestId('set-label-0-0').props.accessibilityLabel).toMatch(/^Set W1,/);
    expect(screen.getByTestId('set-label-0-1').props.accessibilityLabel).toMatch(/^Set 1,/);
  });

  test('long-press a set number asks with the themed confirm; Remove deletes, Cancel keeps', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    fireEvent(screen.getByTestId('set-label-0-1'), 'longPress');
    expect(screen.getByText('Delete this set from the exercise?')).toBeTruthy();
    press('remove-set-keep');
    expect(setsOf(0)).toHaveLength(3);

    fireEvent(screen.getByTestId('set-label-0-1'), 'longPress');
    press('remove-set-confirm');
    expect(setsOf(0)).toHaveLength(2);
  });

  test('swipe deletes immediately, with no confirm', async () => {
    await startPush(startUrl('ppl-push', ['bench-press']));
    press('set-swipe-delete-0-2');
    expect(setsOf(0)).toHaveLength(2);
    expect(screen.queryByText('Delete this set from the exercise?')).toBeNull();
  });

  test('the last set of an exercise cannot be removed', async () => {
    await startPush(startUrl('ppl-push', ['bench-press'], '&sets=1'));
    expect(setsOf(0)).toHaveLength(1);
    expect(screen.queryByTestId('set-swipe-delete-0-0')).toBeNull();
    fireEvent(screen.getByTestId('set-label-0-0'), 'longPress');
    expect(screen.queryByText('Delete this set from the exercise?')).toBeNull();
  });
});
