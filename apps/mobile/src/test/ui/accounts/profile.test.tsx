import { fireEvent, screen } from 'expo-router/testing-library';
import ProfileScreen from '../../../../app/(tabs)/profile';
import { useSettingsStore } from '@/store/settingsStore';
import { renderApp, resetAppState, routeStub } from '../render';
import { linkedUser, signInAs, signInAsGuest } from './helpers';

/** docs/features/accounts-and-data.md#profile — the Profile tab's three cards. */

const routes = {
  '(tabs)/profile': ProfileScreen,
  account: routeStub('account'),
  settings: routeStub('settings'),
  biodata: routeStub('biodata'),
};

beforeEach(async () => {
  await resetAppState();
  useSettingsStore.setState({ profile: {}, bodyWeightUnit: 'kg', isLoading: false });
});

test('guest: sign-in prompt in the Account card', async () => {
  signInAsGuest();
  renderApp(routes, '/profile');
  expect(await screen.findByText('Sign in or create an account')).toBeTruthy();
  expect(screen.getByText('Back up your workouts and use them on any device.')).toBeTruthy();
});

test('linked: provider, display name and email without opening Account', async () => {
  signInAs(linkedUser('apple', 'me@icloud.com'));
  renderApp(routes, '/profile');
  expect(await screen.findByText('Apple ID')).toBeTruthy();
  expect(screen.getByText('Sam Lifter')).toBeTruthy();
  expect(screen.getByText('me@icloud.com')).toBeTruthy();
});

test('the Account card pushes /account', async () => {
  signInAsGuest();
  renderApp(routes, '/profile');
  fireEvent.press(await screen.findByTestId('profile-account'));
  expect(await screen.findByText('route:account')).toBeTruthy();
});

test('the Settings row pushes /settings', async () => {
  signInAsGuest();
  renderApp(routes, '/profile');
  expect(await screen.findByText('Appearance, units, sounds')).toBeTruthy();
  fireEvent.press(screen.getByTestId('profile-settings'));
  expect(await screen.findByText('route:settings')).toBeTruthy();
});

test('biodata hint says what it is for until something is saved', async () => {
  signInAsGuest();
  renderApp(routes, '/profile');
  expect(await screen.findByText('Used for strength standards')).toBeTruthy();
  expect(screen.queryByText(/recovery estimates/)).toBeNull();
  fireEvent.press(screen.getByTestId('profile-biodata'));
  expect(await screen.findByText('route:biodata')).toBeTruthy();
});

test('biodata hint summarises saved fields in display units', async () => {
  signInAsGuest();
  useSettingsStore.setState({ profile: { weightKg: 80, age: 30, sex: 'male' }, bodyWeightUnit: 'lb' });
  renderApp(routes, '/profile');
  expect(await screen.findByText('176.4 lb · 30 · Male')).toBeTruthy();
});
