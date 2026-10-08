import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataScreen from '../../../../app/data';
import { STORAGE_KEYS } from '@/storage/keys';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSyncStore } from '@/store/syncStore';
import { renderApp, resetAppState } from '../render';
import { linkedUser, signInAs, signInAsGuest } from './helpers';
import { syncModuleMock } from './syncMock';

/** docs/features/accounts-and-data.md — Data (/data): Sync now, Export, Import, Clear all data. */

jest.mock('@/sync', () => require('./syncMock').syncModuleMock());
jest.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: jest.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));
jest.mock('@/storage/exportData', () => ({ exportAndShareData: jest.fn(async () => true) }));
jest.mock('@/storage/importData', () => ({ pickImportFile: jest.fn(), applyImport: jest.fn(async () => undefined) }));

const sync = jest.requireMock('@/sync') as ReturnType<typeof syncModuleMock>;
const { exportAndShareData } = jest.requireMock('@/storage/exportData') as { exportAndShareData: jest.Mock };
const { pickImportFile, applyImport } = jest.requireMock('@/storage/importData') as {
  pickImportFile: jest.Mock;
  applyImport: jest.Mock;
};

const routes = { data: DataScreen };
let alertSpy: jest.SpyInstance;

type AlertButton = { text?: string; onPress?: () => void | Promise<void> };
function lastAlert(): { title: string; message?: string; buttons?: AlertButton[] } {
  const call = alertSpy.mock.calls.at(-1);
  return { title: call?.[0], message: call?.[1], buttons: call?.[2] };
}
async function pressAlertButton(text: string) {
  const button = lastAlert().buttons?.find((b) => b.text === text);
  const onPress = button?.onPress;
  if (!onPress) throw new Error(`No alert button ${text}`);
  // The handler sets screen state (and Clear all reloads the theme), so run it inside act.
  await act(async () => {
    await onPress();
  });
}

const plan = (sessions = 2) => ({
  sessions: Array.from({ length: sessions }, (_, i) => ({ id: `s${i}`, exercises: [] })),
  templates: [{ id: 't1', name: 'T', exerciseIds: [] }],
  templateFolders: [],
  customExercises: [],
  exerciseNotes: {},
});

beforeEach(async () => {
  await resetAppState();
  jest.clearAllMocks();
  sync.syncNow.mockResolvedValue(undefined);
  useSyncStore.setState({ isSyncing: false, lastError: null, lastSyncedAt: null });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => alertSpy.mockRestore());

describe('rows', () => {
  test('guests get Export, Import and Clear — no Sync now', async () => {
    signInAsGuest();
    renderApp(routes, '/data');
    expect(await screen.findByText('Export my data')).toBeTruthy();
    expect(screen.getByText('Import data')).toBeTruthy();
    expect(screen.getByText('Clear all data')).toBeTruthy();
    expect(screen.queryByText('Sync now')).toBeNull();
    expect(screen.getByText('This device. Clearing data does not delete a linked account.')).toBeTruthy();
  });

  test('linked accounts also get Sync now', async () => {
    signInAs(linkedUser('email'));
    renderApp(routes, '/data');
    expect(await screen.findByText('Sync now')).toBeTruthy();
  });
});

describe('Sync now (A21)', () => {
  test('says Synced when the sync succeeded', async () => {
    signInAs(linkedUser('email'));
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByText('Sync now'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(sync.syncNow).toHaveBeenCalled();
    expect(lastAlert()).toMatchObject({ title: 'Synced', message: 'Your workout data is up to date.' });
  });

  test('says Sync failed when the sync store reports an error', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    sync.syncNow.mockImplementation(async () => {
      useSyncStore.getState().setError('Failed to fetch');
    });
    signInAs(linkedUser('email'));
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByText('Sync now'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(lastAlert()).toMatchObject({
      title: 'Sync failed',
      message: "Couldn't sync right now. Check your internet connection and try again.",
    });
    expect(warn).toHaveBeenCalledWith('[sync] failed', 'Failed to fetch');
    warn.mockRestore();
  });
});

describe('Export', () => {
  test('shares the export file', async () => {
    signInAsGuest();
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByText('Export my data'));
    await waitFor(() => expect(exportAndShareData).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('explains when sharing is unavailable, and when export fails', async () => {
    signInAsGuest();
    exportAndShareData.mockResolvedValueOnce(false);
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByText('Export my data'));
    await waitFor(() => expect(lastAlert().message).toBe('Sharing is not available on this device.'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    exportAndShareData.mockRejectedValueOnce(new Error('disk'));
    fireEvent.press(await screen.findByText('Export my data'));
    await waitFor(() => expect(lastAlert()).toMatchObject({ title: 'Export failed', message: "Couldn't export your data. Try again." }));
    expect(warn).toHaveBeenCalledWith('[export] failed', expect.any(Error));
    warn.mockRestore();
  });
});

describe('Import', () => {
  test('a file that is not an export, or from another version', async () => {
    signInAsGuest();
    pickImportFile.mockResolvedValueOnce({ status: 'failed', reason: 'invalid' });
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByTestId('import-data'));
    await waitFor(() =>
      expect(lastAlert()).toMatchObject({
        title: "Can't import this file",
        message: 'Choose a file made with Export my data in MuscleOS.',
      })
    );
    pickImportFile.mockResolvedValueOnce({ status: 'failed', reason: 'unsupported_version' });
    fireEvent.press(screen.getByTestId('import-data'));
    await waitFor(() => expect(lastAlert().message).toMatch(/Update the app/));
  });

  test('nothing new in the file', async () => {
    signInAsGuest();
    pickImportFile.mockResolvedValueOnce({ status: 'ready', plan: { ...plan(0), templates: [] }, exportedAt: null });
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByTestId('import-data'));
    await waitFor(() =>
      expect(lastAlert()).toMatchObject({
        title: 'Nothing to import',
        message: 'Everything in this file is already on this device.',
      })
    );
  });

  test('a cancelled picker shows nothing', async () => {
    signInAsGuest();
    pickImportFile.mockResolvedValueOnce({ status: 'cancelled' });
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByTestId('import-data'));
    await waitFor(() => expect(pickImportFile).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('guest: confirm names what is added, Import applies it', async () => {
    signInAsGuest();
    pickImportFile.mockResolvedValueOnce({ status: 'ready', plan: plan(2), exportedAt: null });
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByTestId('import-data'));
    await waitFor(() =>
      expect(lastAlert()).toMatchObject({
        title: 'Import data',
        message: 'Add 2 workouts and 1 template to this device? Nothing already here is changed or removed.',
      })
    );
    await pressAlertButton('Import');
    expect(applyImport).toHaveBeenCalled();
    expect(lastAlert()).toMatchObject({ title: 'Imported', message: 'Added 2 workouts and 1 template.' });
  });

  test('signed in: the confirm says it backs up; an apply failure says so', async () => {
    signInAs(linkedUser('email'));
    pickImportFile.mockResolvedValueOnce({ status: 'ready', plan: plan(1), exportedAt: null });
    applyImport.mockRejectedValueOnce(new Error('disk full'));
    renderApp(routes, '/data');
    fireEvent.press(await screen.findByTestId('import-data'));
    await waitFor(() => expect(lastAlert().message).toMatch(/It also backs up to your account\.$/));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await pressAlertButton('Import');
    expect(lastAlert()).toMatchObject({ title: 'Import failed', message: "Couldn't import your data. Try again." });
    expect(warn).toHaveBeenCalledWith('[import] apply failed', expect.any(Error));
    warn.mockRestore();
  });
});

describe('Clear all data (D15)', () => {
  test('wipes this device only, keeps the session/outbox, and reloads every store', async () => {
    signInAs(linkedUser('email'));
    await AsyncStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify([{ id: 's1', templateId: 'x', startedAt: '2026-01-01T00:00:00.000Z', exercises: [] }])
    );
    await AsyncStorage.setItem(STORAGE_KEYS.templates, JSON.stringify([{ id: 't1', name: 'T', exerciseIds: [] }]));
    await AsyncStorage.setItem(STORAGE_KEYS.exerciseNotes, JSON.stringify({ squat: 'Note' }));
    await AsyncStorage.setItem('muscleos_theme', 'dark');
    await AsyncStorage.setItem('muscleos_exercise_weight_unit', 'lb');
    await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, '[]');
    await useSessionsStore.getState().load();
    await useTemplatesStore.getState().load();
    await useExerciseNotesStore.getState().load();
    await useSettingsStore.getState().load();
    expect(useSessionsStore.getState().sessions).toHaveLength(1);

    renderApp(routes, '/data');
    fireEvent.press(await screen.findByText('Clear all data'));
    expect(lastAlert()).toMatchObject({
      title: 'Clear all data',
      message: 'Resets settings, workouts, sessions, and recovery. You stay signed in. This cannot be undone.',
    });
    await pressAlertButton('Clear all');

    expect(lastAlert()).toMatchObject({ title: 'Done', message: 'All data has been cleared.' });
    expect(await AsyncStorage.getItem(STORAGE_KEYS.sessions)).toBeNull();
    expect(await AsyncStorage.getItem('muscleos_theme')).toBe('auto');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.syncOutbox)).toBe('[]');
    expect(useSessionsStore.getState().sessions).toEqual([]);
    expect(useTemplatesStore.getState().userTemplates).toEqual([]);
    expect(useExerciseNotesStore.getState().notes).toEqual({});
    expect(useSettingsStore.getState().weightUnit).toBe('kg');
    // Device-only: nothing is offered to sync, so the account's cloud settings are untouched (H7).
    expect(sync.notifyAppSettingsSnapshot).not.toHaveBeenCalled();
    expect(sync.schedulePush).not.toHaveBeenCalled();
  });
});
