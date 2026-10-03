import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BiodataScreen from '../../../../app/biodata';
import SettingsScreen from '../../../../app/settings';
import { useSettingsStore } from '@/store/settingsStore';
import { getAppSettings } from '@/storage/localStorage';
import { renderApp, resetAppState } from '../render';
import { syncModuleMock } from './syncMock';

/** docs/features/accounts-and-data.md#profile and #settings — Biodata and Settings screens. */

jest.mock('@/sync', () => require('./syncMock').syncModuleMock());
const sync = jest.requireMock('@/sync') as ReturnType<typeof syncModuleMock>;

beforeEach(async () => {
  await resetAppState();
  jest.clearAllMocks();
  await useSettingsStore.getState().load();
});

describe('Biodata', () => {
  test('says biodata is for strength standards, and shows dashes until set', async () => {
    renderApp({ biodata: BiodataScreen }, '/biodata');
    expect(await screen.findByText('Used for strength standards')).toBeTruthy();
    expect(screen.queryByText(/recovery estimates/)).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  test('Edit → Save stores valid values in kg/cm and syncs them', async () => {
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.press(screen.getByText('female'));
    fireEvent.changeText(screen.getByPlaceholderText('Height (cm)'), '170');
    fireEvent.changeText(screen.getByPlaceholderText('Weight (kg)'), '65.5');
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '34');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () =>
      expect((await getAppSettings()).profile).toEqual({ heightCm: 170, weightKg: 65.5, age: 34, sex: 'female' })
    );
    expect(screen.getByText('170 cm')).toBeTruthy();
    expect(screen.getByText('65.5 kg')).toBeTruthy();
    expect(screen.getByText('Female')).toBeTruthy();
    expect(sync.notifyAppSettingsSnapshot).toHaveBeenCalled();
  });

  test('invalid values clear the field; age must be under 150', async () => {
    await useSettingsStore.getState().setProfile({ heightCm: 180, weightKg: 80, age: 30 });
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByPlaceholderText('Height (cm)'), '0');
    fireEvent.changeText(screen.getByPlaceholderText('Weight (kg)'), 'abc');
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '150');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () => expect((await getAppSettings()).profile).toEqual({}));
  });

  test('imperial units: inputs and display convert', async () => {
    await useSettingsStore.getState().setHeightUnit('in');
    await useSettingsStore.getState().setBodyWeightUnit('lb');
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByPlaceholderText('Height (in)'), '70');
    fireEvent.changeText(screen.getByPlaceholderText('Weight (lb)'), '176');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () => expect((await getAppSettings()).profile).toMatchObject({ heightCm: 177.8, weightKg: 79.83 }));
    expect(screen.getByText('70 in')).toBeTruthy();
    expect(screen.getByText('176 lb')).toBeTruthy();
  });

  test('Cancel keeps the saved values', async () => {
    await useSettingsStore.getState().setProfile({ age: 30 });
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '45');
    fireEvent.press(screen.getByText('Cancel'));
    expect((await getAppSettings()).profile).toEqual({ age: 30 });
  });
});

describe('Settings', () => {
  test('appearance, units and sounds only', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    expect(await screen.findByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Auto follows your device. Dark and Light stay fixed.')).toBeTruthy();
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByText('Sounds')).toBeTruthy();
    expect(screen.queryByText('Privacy Policy')).toBeNull();
  });

  test('units are independent and persist', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    await screen.findByText('Units');
    // Order on screen: Height (cm|in), Body weight (kg|lb), Exercise weight (kg|lb).
    // Two quick taps: both changes must survive (settings writes are serialized).
    fireEvent.press(screen.getByText('in'));
    fireEvent.press(screen.getAllByText('lb')[1]);
    await waitFor(async () =>
      expect(await getAppSettings()).toMatchObject({ heightUnit: 'in', bodyWeightUnit: 'kg', weightUnit: 'lb' })
    );
  });

  test('workout sounds default on and can be turned off', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    const toggle = await screen.findByRole('switch');
    expect(toggle.props.value).toBe(true);
    fireEvent(toggle, 'valueChange', false);
    await waitFor(async () => expect((await getAppSettings()).workoutSoundsEnabled).toBe(false));
  });

  test('theme defaults to Auto, persists a choice, and syncs it', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    fireEvent.press(await screen.findByText('Dark'));
    await waitFor(async () => expect(await AsyncStorage.getItem('muscleos_theme')).toBe('dark'));
    expect(sync.notifyAppSettingsSnapshot).toHaveBeenCalledWith(expect.objectContaining({ themePreference: 'dark' }));
  });
});
