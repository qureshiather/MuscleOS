/**
 * Exercises and History tab rows of the gate map (docs/features/subscriptions.md#gate-map).
 */
import type { Exercise, WorkoutSession } from '@muscleos/types';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import ExercisesScreen from '../../../../app/(tabs)/exercises';
import HistoryScreen from '../../../../app/(tabs)/history';
import { setSessions } from '@/storage/localStorage';
import { useExercisesStore } from '@/store/exercisesStore';
import { renderApp, setPro } from '../render';
import { resetGateState, stubs } from './helpers';

const CUSTOM_EXERCISE: Exercise = {
  id: 'custom_1',
  name: 'Zorbatron Press',
  muscles: ['chest'],
  equipment: [],
  category: 'machine',
};

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(async () => {
  await resetGateState();
  useExercisesStore.setState({ customExercises: [CUSTOM_EXERCISE] });
});

describe('(tabs)/exercises', () => {
  const render = () =>
    renderApp(
      { exercises: ExercisesScreen, subscription: stubs.subscription, 'create-exercise': stubs['create-exercise'] },
      '/exercises'
    );

  async function pressAdd() {
    await screen.findByText('Exercises');
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'add', size: 22 }));
  }

  test('Basic: the + button opens the custom_exercises paywall', async () => {
    const r = render();
    await pressAdd();
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'custom_exercises' });
  });

  test('Pro: the + button opens the exercise builder', async () => {
    setPro(true);
    const r = render();
    await pressAdd();
    expect(await screen.findByText('route:create-exercise')).toBeTruthy();
    expect(r.getPathname()).toBe('/create-exercise');
  });

  test('Basic: create-from-search shows the Pro hint and opens the paywall', async () => {
    const r = render();
    fireEvent.changeText(await screen.findByPlaceholderText('Search by name, muscle, equipment...'), 'qqqxx');
    expect(await screen.findByText('Pro · save your own exercises.')).toBeTruthy();
    fireEvent.press(screen.getByText('Create “qqqxx”'));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'custom_exercises' });
  });

  test('Pro: create-from-search opens the builder with the name', async () => {
    setPro(true);
    const r = render();
    fireEvent.changeText(await screen.findByPlaceholderText('Search by name, muscle, equipment...'), 'qqqxx');
    expect(await screen.findByText('Add it as a custom exercise on your account.')).toBeTruthy();
    fireEvent.press(screen.getByText('Create “qqqxx”'));
    expect(await screen.findByText('route:create-exercise')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ name: 'qqqxx' });
  });

  test('Basic: editing an existing custom exercise opens the paywall; the exercise stays visible', async () => {
    const r = render();
    fireEvent.changeText(await screen.findByPlaceholderText('Search by name, muscle, equipment...'), 'Zorbatron');
    fireEvent.press(await screen.findByText('Zorbatron Press'));
    fireEvent.press(await screen.findByText('Edit'));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'custom_exercises' });
  });

  test('Pro: Edit opens the builder for that exercise', async () => {
    setPro(true);
    const r = render();
    fireEvent.changeText(await screen.findByPlaceholderText('Search by name, muscle, equipment...'), 'Zorbatron');
    fireEvent.press(await screen.findByText('Zorbatron Press'));
    fireEvent.press(await screen.findByText('Edit'));
    expect(await screen.findByText('route:create-exercise')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ id: 'custom_1' });
  });
});

describe('(tabs)/history', () => {
  const session: WorkoutSession = {
    id: 'session_1',
    templateId: 'ppl-push',
    startedAt: '2026-05-01T10:00:00.000Z',
    completedAt: '2026-05-01T11:00:00.000Z',
    exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 80, reps: 5 }] }],
  };
  /** Beats the first session's bench, so it carries a PR. */
  const prSession: WorkoutSession = {
    ...session,
    id: 'session_2',
    startedAt: '2026-05-03T10:00:00.000Z',
    completedAt: '2026-05-03T11:00:00.000Z',
    exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 100, reps: 5 }] }],
  };

  const render = () =>
    renderApp(
      {
        history: HistoryScreen,
        subscription: stubs.subscription,
        'personal-records': stubs['personal-records'],
        'history-monthly': stubs['history-monthly'],
      },
      '/history'
    );

  test.each([
    ['trophy-outline', 'personal_records', 'personal-records'],
    ['calendar-outline', 'monthly_calendar', 'history-monthly'],
  ])('%s: Basic → paywall (%s), Pro → /%s', async (icon, feature, route) => {
    const basic = render();
    await screen.findByText('History');
    fireEvent.press(screen.UNSAFE_getByProps({ name: icon }));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(basic.getSearchParams()).toEqual({ feature });
    basic.unmount();

    setPro(true);
    const pro = render();
    await screen.findByText('History');
    fireEvent.press(screen.UNSAFE_getByProps({ name: icon }));
    expect(await screen.findByText(`route:${route}`)).toBeTruthy();
    expect(pro.getPathname()).toBe(`/${route}`);
  });

  test('PR badges and counts are hidden on Basic (no paywall) and shown on Pro', async () => {
    await setSessions([session, prSession]);
    const basic = render();
    expect((await screen.findAllByText(/Push/)).length).toBeGreaterThan(0);
    await settle();
    expect(screen.queryByText(/\bPRs?\b/)).toBeNull();
    expect(basic.getPathname()).toBe('/history');
    basic.unmount();

    setPro(true);
    render();
    expect((await screen.findAllByText(/PR/)).length).toBeGreaterThan(0);
  });
});
