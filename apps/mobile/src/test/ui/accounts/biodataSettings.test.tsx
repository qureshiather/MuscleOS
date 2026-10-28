import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard } from 'react-native';
import BiodataScreen from '../../../../app/biodata';
import SettingsScreen from '../../../../app/settings';
import { useSettingsStore } from '@/store/settingsStore';
import { getAppSettings } from '@/storage/localStorage';
import { renderApp, resetAppState } from '../render';
import type { syncModuleMock } from './syncMock';

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
    expect(screen.getAllByText('—')).toHaveLength(3);
    // Weight, age and gender are collected; height isn't.
    expect(screen.queryByText(/Height/)).toBeNull();
  });

  test('Edit → Save stores valid values in kg and syncs them', async () => {
    await useSettingsStore.getState().setBodyWeightUnit('kg');
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    // Each field has a visible label (the read-only row shows the same text), not just a placeholder.
    expect(screen.getAllByText('Weight (kg)')).toHaveLength(2);
    expect(screen.getAllByText('Age')).toHaveLength(2);
    fireEvent.press(screen.getByText('female'));
    fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '65.5');
    fireEvent.changeText(screen.getByLabelText('Age'), '34');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () =>
      expect((await getAppSettings()).profile).toEqual({ weightKg: 65.5, age: 34, sex: 'female' })
    );
    expect(screen.getByText('34')).toBeTruthy();
    expect(screen.getByText('65.5 kg')).toBeTruthy();
    expect(screen.getByText('Female')).toBeTruthy();
    expect(sync.notifyAppSettingsSnapshot).toHaveBeenCalled();
  });

  test('shows the accepted range under weight and age', async () => {
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    expect(screen.getByText('Between 66 and 660 lb')).toBeTruthy();
    expect(screen.getByText('Between 13 and 100')).toBeTruthy();
  });

  test('out-of-range values block Save with a message, and editing clears it', async () => {
    await useSettingsStore.getState().setProfile({ weightKg: 80, age: 30 });
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByLabelText('Weight (lb)'), '5');
    fireEvent.changeText(screen.getByLabelText('Age'), '250');
    fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('Enter a weight between 66 and 660 lb')).toBeTruthy();
    expect(screen.getByText('Enter an age between 13 and 100')).toBeTruthy();
    // The editor stays open and nothing was written.
    expect(screen.getByText('Save')).toBeTruthy();
    expect((await getAppSettings()).profile).toEqual({ weightKg: 80, age: 30 });
    fireEvent.changeText(screen.getByLabelText('Age'), '31');
    expect(screen.queryByText('Enter an age between 13 and 100')).toBeNull();
    expect(screen.getByText('Between 13 and 100')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Weight (lb)'), '180');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () => expect((await getAppSettings()).profile).toEqual({ weightKg: 81.65, age: 31 }));
  });

  test('blank fields clear the saved values', async () => {
    await useSettingsStore.getState().setProfile({ weightKg: 80, age: 30 });
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByLabelText('Weight (lb)'), '');
    fireEvent.changeText(screen.getByLabelText('Age'), '');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () => expect((await getAppSettings()).profile).toEqual({}));
  });

  test('pounds (the default): input and display convert', async () => {
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByLabelText('Weight (lb)'), '176');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () => expect((await getAppSettings()).profile).toEqual({ weightKg: 79.83 }));
    expect(screen.getByText('176 lb')).toBeTruthy();
  });

  test('Cancel keeps the saved values', async () => {
    await useSettingsStore.getState().setProfile({ age: 30 });
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByLabelText('Age'), '45');
    fireEvent.press(screen.getByText('Cancel'));
    expect((await getAppSettings()).profile).toEqual({ age: 30 });
  });

  test('the number keyboards get a Done key on iOS, which has no return key on them', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    expect(screen.getByLabelText('Weight (lb)').props.inputAccessoryViewID).toBe('biodata-keyboard-done');
    expect(screen.getByLabelText('Age').props.inputAccessoryViewID).toBe('biodata-keyboard-done');
    fireEvent.press(screen.getByText('Done'));
    expect(dismiss).toHaveBeenCalled();
  });

  test('a tap outside the editor with the keyboard up lowers it and keeps the edits', async () => {
    const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    renderApp({ biodata: BiodataScreen }, '/biodata');
    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.changeText(screen.getByLabelText('Weight (lb)'), '190');
    fireEvent.press(screen.getByTestId('biodata-backdrop'));
    expect(dismiss).toHaveBeenCalled();
    expect(screen.getByText('Save')).toBeTruthy();
    // With the keyboard down, the same tap closes the editor without saving.
    visible.mockReturnValue(false);
    fireEvent.press(screen.getByTestId('biodata-backdrop'));
    await waitFor(() => expect(screen.queryByText('Save')).toBeNull());
    expect((await getAppSettings()).profile).toEqual({});
    visible.mockRestore();
  });
});

describe('Settings', () => {
  test('appearance, units, workouts and sounds only', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    expect(await screen.findByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Auto follows your device. Dark and Light stay fixed.')).toBeTruthy();
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByText('Workouts')).toBeTruthy();
    expect(screen.getByText('Sounds')).toBeTruthy();
    expect(screen.queryByText('Privacy Policy')).toBeNull();
    // Acknowledgements moved to About.
    expect(screen.queryByText('About')).toBeNull();
    expect(screen.queryByText('Acknowledgements')).toBeNull();
  });

  test('units are independent and persist', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    await screen.findByText('Units');
    // Order on screen: Body weight (kg|lb), Exercise weight (kg|lb). No height unit.
    expect(screen.queryByText('in')).toBeNull();
    // Two quick taps: both changes must survive (settings writes are serialized).
    fireEvent.press(screen.getAllByText('lb')[0]);
    fireEvent.press(screen.getAllByText('lb')[1]);
    await waitFor(async () =>
      expect(await getAppSettings()).toMatchObject({ bodyWeightUnit: 'lb', weightUnit: 'lb' })
    );
  });

  test('default rest is 2:00 and can be set to any m:ss; it persists and syncs (MUS-169)', async () => {
    renderApp({ settings: SettingsScreen }, '/settings');
    const row = await screen.findByTestId('settings-default-rest');
    expect(screen.getByText('2:00')).toBeTruthy();
    fireEvent.press(row);
    fireEvent.press(await screen.findByTestId('rest-time-work'));
    expect(screen.queryByTestId('rest-time-warmUp')).toBeNull();
    for (const d of ['1', '4', '5']) fireEvent.press(screen.getByTestId(`keypad-key-${d}`));
    fireEvent.press(screen.getByTestId('rest-timers-save'));
    expect(await screen.findByText('1:45')).toBeTruthy();
    await waitFor(async () => expect((await getAppSettings()).defaultRestSeconds).toBe(105));
    expect(sync.notifyAppSettingsSnapshot).toHaveBeenCalledWith(expect.objectContaining({ defaultRestSeconds: 105 }));
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
