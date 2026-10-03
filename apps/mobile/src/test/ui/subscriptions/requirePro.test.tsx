/**
 * Whole-screen Pro gates (`useRequirePro`): Basic is redirected to the paywall with the screen's
 * feature, Pro renders, and a Pro user is never bounced while the tier is still loading.
 */
import type { ComponentType } from 'react';
import { act, screen } from 'expo-router/testing-library';
import PersonalRecordsScreen from '../../../../app/personal-records';
import HistoryMonthlyScreen from '../../../../app/history-monthly';
import ExerciseProgressionScreen from '../../../../app/exercise-progression';
import CreateTemplateScreen from '../../../../app/create-template';
import CreateExerciseScreen from '../../../../app/create-exercise';
import { renderApp, routeStub, setPro } from '../render';
import { resetGateState, setSubscriptionLoading } from './helpers';

type Case = {
  route: string;
  Screen: ComponentType;
  feature: string;
  /** Text that proves the screen rendered for Pro. */
  proText: string | RegExp;
};

const cases: Case[] = [
  { route: 'personal-records', Screen: PersonalRecordsScreen, feature: 'personal_records', proText: 'Personal records' },
  { route: 'history-monthly', Screen: HistoryMonthlyScreen, feature: 'monthly_calendar', proText: 'Calendar' },
  {
    route: 'exercise-progression',
    Screen: ExerciseProgressionScreen,
    feature: 'exercise_progression',
    proText: 'No progression data for this exercise.',
  },
  { route: 'create-template', Screen: CreateTemplateScreen, feature: 'custom_templates', proText: 'New template' },
  { route: 'create-exercise', Screen: CreateExerciseScreen, feature: 'custom_exercises', proText: 'New exercise' },
];

async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(resetGateState);

describe.each(cases)('/$route', ({ route, Screen, feature, proText }) => {
  const render = () =>
    renderApp({ [route]: Screen, subscription: routeStub('subscription') }, `/${route}`);

  test(`Basic cold start redirects to /subscription?feature=${feature}`, async () => {
    const r = render();
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getPathname()).toBe('/subscription');
    expect(r.getSearchParams()).toEqual({ feature });
  });

  test('Pro renders the screen', async () => {
    setPro(true);
    const r = render();
    expect(await screen.findByText(proText)).toBeTruthy();
    expect(r.getPathname()).toBe(`/${route}`);
  });

  test('does not redirect while the tier is loading, then renders for Pro', async () => {
    setSubscriptionLoading();
    const r = render();
    await flush();
    expect(r.getPathname()).toBe(`/${route}`);
    expect(screen.queryByText('route:subscription')).toBeNull();
    act(() => setPro(true));
    expect(await screen.findByText(proText)).toBeTruthy();
    expect(r.getPathname()).toBe(`/${route}`);
  });
});
