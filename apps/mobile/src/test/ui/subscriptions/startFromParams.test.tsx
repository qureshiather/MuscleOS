import { screen, waitFor } from 'expo-router/testing-library';
import ActiveWorkoutScreen from '../../../../app/active-workout';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { renderApp, resetAppState, routeStub, setPro } from '../render';

beforeEach(async () => {
  await resetAppState();
  useActiveWorkoutStore.setState({ session: null, hydrated: true });
});

test('deep link to a built-in template starts the workout for Basic', async () => {
  renderApp(
    { 'active-workout': ActiveWorkoutScreen, subscription: routeStub('subscription') },
    '/active-workout?templateId=ppl-push'
  );
  await waitFor(() => expect(useActiveWorkoutStore.getState().session).not.toBeNull());
});

test('deep link to the empty workout sends Basic to the paywall', async () => {
  setPro(false);
  const r = renderApp(
    { 'active-workout': ActiveWorkoutScreen, subscription: routeStub('subscription') },
    '/active-workout?templateId=_empty'
  );
  expect(await screen.findByText('route:subscription')).toBeTruthy();
  expect(r.getPathname()).toBe('/subscription');
  expect(useActiveWorkoutStore.getState().session).toBeNull();
});
