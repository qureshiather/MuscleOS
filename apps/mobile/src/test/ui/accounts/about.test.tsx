import { fireEvent, screen } from 'expo-router/testing-library';
import AboutScreen from '../../../../app/about';
import AcknowledgementsScreen from '../../../../app/acknowledgements';
import { renderApp, resetAppState } from '../render';

/** docs/features/accounts-and-data.md#about and #acknowledgements — the About and Acknowledgements screens. */

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0', nativeBuildVersion: '42' }));

const { openBrowserAsync } = jest.requireMock('expo-web-browser') as { openBrowserAsync: jest.Mock };

const routes = { about: AboutScreen, acknowledgements: AcknowledgementsScreen };

beforeEach(async () => {
  await resetAppState();
  jest.clearAllMocks();
});

test('shows the app version with its build number', async () => {
  renderApp(routes, '/about');
  expect(await screen.findByText('Version 1.0.0 (42)')).toBeTruthy();
});

test('legal links open the website', async () => {
  renderApp(routes, '/about');
  fireEvent.press(await screen.findByText('Privacy Policy'));
  fireEvent.press(screen.getByText('Terms of Service'));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://muscleos.app/privacy');
  expect(openBrowserAsync).toHaveBeenCalledWith('https://muscleos.app/terms');
});

test('Acknowledgements lists open-source notices, artwork credit and licenses', async () => {
  renderApp(routes, '/about');
  fireEvent.press(await screen.findByTestId('about-acknowledgements'));
  expect(await screen.findByText('Libraries — MIT License')).toBeTruthy();
  expect(screen.getByText('Artwork — MIT License')).toBeTruthy();
  expect(screen.getByText('Body diagram figures, from react-native-body-highlighter')).toBeTruthy();
  expect(screen.getByText('Copyright (c) 2022 ELABBASSI Hicham')).toBeTruthy();
  expect(screen.getByText('DM Sans')).toBeTruthy();
  expect(screen.getByText('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007')).toBeTruthy();
});
