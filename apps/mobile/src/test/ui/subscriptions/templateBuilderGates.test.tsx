/**
 * Template builder: the exercise picker's "Create '<query>'" row is gated by `custom_exercises`
 * (docs/features/subscriptions.md#gate-map). The screen itself requires Pro, so on Basic the row
 * is unreachable; the row's own gate is defence in depth.
 */
import { act, fireEvent, screen } from 'expo-router/testing-library';
import CreateTemplateScreen from '../../../../app/create-template';
import { renderApp, setPro } from '../render';
import { resetGateState, stubs } from './helpers';

beforeEach(resetGateState);

function render() {
  return renderApp(
    {
      'create-template': CreateTemplateScreen,
      subscription: stubs.subscription,
      'create-exercise': stubs['create-exercise'],
    },
    '/create-template'
  );
}

async function searchForMissingExercise() {
  fireEvent.press(await screen.findByText('Add exercises'));
  fireEvent.changeText(await screen.findByPlaceholderText('Search...'), 'qqqxx');
  return screen.findByText('Create “qqqxx”');
}

test('Pro: Create "<query>" opens the exercise builder with the name', async () => {
  setPro(true);
  const r = render();
  fireEvent.press(await searchForMissingExercise());
  expect(await screen.findByText('route:create-exercise')).toBeTruthy();
  expect(r.getSearchParams()).toEqual({ name: 'qqqxx' });
});

test('a lapse while the builder is open redirects to the custom_templates paywall', async () => {
  setPro(true);
  const r = render();
  await searchForMissingExercise();
  act(() => setPro(false));
  expect(await screen.findByText('route:subscription')).toBeTruthy();
  expect(r.getSearchParams()).toEqual({ feature: 'custom_templates' });
});
