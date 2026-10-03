import { screen } from 'expo-router/testing-library';
import HomeScreen from '../../../app/(tabs)/index';
import { renderApp, resetAppState } from './render';

beforeEach(resetAppState);

test('renders a real screen through the router with theme and safe-area providers', async () => {
  renderApp({ index: HomeScreen });
  expect(await screen.findByText(/Suggested/i)).toBeTruthy();
});
