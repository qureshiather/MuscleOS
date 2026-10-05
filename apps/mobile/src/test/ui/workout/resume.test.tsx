import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import HomeScreen from '../../../../app/(tabs)/index';
import { ResumeWorkoutPill } from '@/components/ResumeWorkoutPill';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { renderApp, routeStub } from '../render';
import { resetWorkoutState, session } from './helpers';

/** Resuming and the one-workout-at-a-time rule (docs/features/workout-logging.md#session-lifecycle). */

jest.mock('@/sync', () => ({
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  syncAfterWorkout: jest.fn(async () => undefined),
}));

beforeEach(() => resetWorkoutState());

async function startInProgress() {
  await act(async () => {
    await useActiveWorkoutStore.getState().startWorkout('ppl-push', [{ exerciseId: 'bench-press' }]);
  });
}

describe('Resume workout pill', () => {
  function renderPill() {
    return renderApp({ index: ResumeWorkoutPill, 'active-workout': routeStub('active-workout') }, '/');
  }

  test('is hidden with no workout in progress', () => {
    renderPill();
    expect(screen.queryByTestId('resume-workout-pill')).toBeNull();
  });

  test('shows elapsed time and opens the workout', async () => {
    await startInProgress();
    const r = renderPill();
    expect(screen.getByText('Resume workout')).toBeTruthy();
    expect(screen.getByText(/^\d+:\d\d$/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Resume workout'));
    await waitFor(() => expect(r.getPathname()).toBe('/active-workout'));
  });

  test('X discards the workout immediately, with no confirmation', async () => {
    await startInProgress();
    renderPill();
    fireEvent.press(screen.getByLabelText('Discard workout'));
    expect(session()).toBeNull();
    expect(screen.queryByTestId('resume-workout-pill')).toBeNull();
  });
});

describe('Workout in progress dialog (home)', () => {
  function renderHome() {
    return renderApp(
      {
        index: HomeScreen,
        'active-workout': routeStub('active-workout'),
        'workout-preview': routeStub('workout-preview'),
      },
      '/'
    );
  }

  test('blocks a second start; Resume workout opens the running one', async () => {
    await startInProgress();
    const first = session();
    const r = renderHome();
    fireEvent.press(await screen.findByText('Empty workout'));
    expect(screen.getByText('Workout in progress')).toBeTruthy();
    expect(
      screen.getByText('Finish or cancel your current workout before starting another.')
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('resume-workout-confirm'));
    await waitFor(() => expect(r.getPathname()).toBe('/active-workout'));
    expect(r.getSearchParams()).toEqual({});
    expect(session()).toBe(first);
  });

  test('Cancel workout discards with no extra confirm and continues the blocked start', async () => {
    await startInProgress();
    const r = renderHome();
    fireEvent.press(await screen.findByText('Empty workout'));
    fireEvent.press(screen.getByTestId('resume-workout-cancel'));
    expect(session()).toBeNull();
    await waitFor(() => expect(r.getPathname()).toBe('/active-workout'));
    expect(r.getSearchParams()).toMatchObject({ templateId: '_empty' });
  });

  test('tapping the overlay dismisses and keeps the workout', async () => {
    await startInProgress();
    renderHome();
    fireEvent.press(await screen.findByText('Empty workout'));
    fireEvent.press(screen.getAllByLabelText('Dismiss').at(-1)!);
    await waitFor(() => expect(screen.queryByText('Workout in progress')).toBeNull());
    expect(session()).not.toBeNull();
  });
});
