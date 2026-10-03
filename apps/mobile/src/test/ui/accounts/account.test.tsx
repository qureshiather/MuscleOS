import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AccountScreen from '../../../../app/account';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { STORAGE_KEYS } from '@/storage/keys';
import { renderApp, resetAppState, routeStub } from '../render';
import { linkedUser, signInAs, signInAsGuest } from './helpers';

/** docs/features/accounts-and-data.md#profile — the Account screen (/account). */

jest.mock('@/sync', () => ({
  syncNow: jest.fn(async () => undefined),
  notifyAppSettingsSnapshot: jest.fn(),
}));
jest.mock('@/auth/signIn', () => ({
  useSignIn: () => ({ linkGoogleToAccount: jest.fn(async () => false) }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const { syncNow } = jest.requireMock('@/sync') as { syncNow: jest.Mock };
const { openBrowserAsync } = jest.requireMock('expo-web-browser') as { openBrowserAsync: jest.Mock };

const routes = {
  account: AccountScreen,
  auth: routeStub('auth'),
  data: routeStub('data'),
  subscription: routeStub('subscription'),
  'auth-new-password': routeStub('auth-new-password'),
};

beforeEach(async () => {
  await resetAppState();
  syncNow.mockReset();
  syncNow.mockResolvedValue(undefined);
  useSyncStore.setState({ isSyncing: false, lastError: null, lastSyncedAt: null });
});

describe('guest', () => {
  test('explains why to sign in and links to /auth; no sync, sign-out or delete', async () => {
    signInAsGuest();
    renderApp(routes, '/account');
    expect(await screen.findByText('Sign in to back up your data and restore Pro on any device.')).toBeTruthy();
    expect(screen.queryByText('Sign out')).toBeNull();
    expect(screen.queryByTestId('delete-account')).toBeNull();
    expect(screen.queryByTestId('change-password')).toBeNull();
    expect(screen.getByText('Export, import, clear this device')).toBeTruthy();
    fireEvent.press(screen.getByText('Sign in'));
    expect(await screen.findByText('route:auth')).toBeTruthy();
  });

  test('legal links open the website', async () => {
    signInAsGuest();
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByText('Privacy Policy'));
    fireEvent.press(screen.getByText('Terms of Service'));
    expect(openBrowserAsync).toHaveBeenCalledWith('https://muscleos.app/privacy');
    expect(openBrowserAsync).toHaveBeenCalledWith('https://muscleos.app/terms');
  });
});

describe('linked account', () => {
  test('shows identity, Data with sync, and Delete account', async () => {
    signInAs(linkedUser('google', 'sam@gmail.com'));
    renderApp(routes, '/account');
    expect(await screen.findByText('Google')).toBeTruthy();
    expect(screen.getByText('sam@gmail.com')).toBeTruthy();
    expect(screen.getByText('Sync, export, import, clear')).toBeTruthy();
    expect(screen.getByTestId('delete-account')).toBeTruthy();
    expect(screen.queryByTestId('link-google')).toBeNull();
  });

  test('Change password only for an account with an email identity', async () => {
    signInAs(linkedUser('apple', 'me@icloud.com'));
    const first = renderApp(routes, '/account');
    expect(await screen.findByText('Apple ID')).toBeTruthy();
    expect(screen.queryByTestId('change-password')).toBeNull();
    expect(screen.getByTestId('link-google')).toBeTruthy();
    first.unmount();

    signInAs(linkedUser('email'));
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByTestId('change-password'));
    expect(await screen.findByText('route:auth-new-password')).toBeTruthy();
  });

  test('Hide My Email accounts are told to link Google before using Android', async () => {
    signInAs(linkedUser('apple', 'x1@privaterelay.appleid.com'));
    renderApp(routes, '/account');
    expect(await screen.findByTestId('hidden-email-notice')).toBeTruthy();
  });
});

describe('sync row', () => {
  test('never synced → tap syncs', async () => {
    signInAs(linkedUser('email'));
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByText('Not synced yet — tap to sync'));
    await waitFor(() => expect(syncNow).toHaveBeenCalled());
  });

  test('shows the last sync time from sync meta', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ lastSyncedAt: new Date().toISOString() }));
    signInAs(linkedUser('email'));
    renderApp(routes, '/account');
    expect(await screen.findByText('Last synced Just now')).toBeTruthy();
  });

  test('a failed sync shows on the row (A21)', async () => {
    syncNow.mockImplementation(async () => {
      useSyncStore.getState().setError('JWT expired');
    });
    signInAs(linkedUser('email'));
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByText('Not synced yet — tap to sync'));
    expect(await screen.findByText('Sync failed — tap to retry')).toBeTruthy();
    expect(screen.queryByText(/JWT/)).toBeNull();
  });

  test('shows progress while syncing', async () => {
    signInAs(linkedUser('email'));
    renderApp(routes, '/account');
    await screen.findByText('Not synced yet — tap to sync');
    act(() => useSyncStore.setState({ isSyncing: true }));
    expect(await screen.findByText('Syncing…')).toBeTruthy();
  });
});

describe('sign out', () => {
  test('asks first, then signs out to a guest', async () => {
    const signOut = jest.fn(async () => {
      useAuthStore.setState({ isAnonymous: true, profile: null });
    });
    signInAs(linkedUser('email'));
    useAuthStore.setState({ signOut });
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByText('Sign out'));
    expect(
      screen.getByText(
        'You will stay on this device as a guest. Your subscription stays on your account and can be restored on another device.'
      )
    ).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    const buttons = screen.getAllByText('Sign out');
    fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(await screen.findByText('Sign in to back up your data and restore Pro on any device.')).toBeTruthy();
  });
});

describe('delete account', () => {
  test('two confirms, then the account is gone and you are a guest', async () => {
    const deleteAccount = jest.fn(async () => {
      useAuthStore.setState({ isAnonymous: true, profile: null });
    });
    signInAs(linkedUser('email'));
    useAuthStore.setState({ deleteAccount });
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByTestId('delete-account'));
    expect(screen.getByText(/Apple, Google, and password sign-in with the same address are the same account/)).toBeTruthy();
    expect(screen.getByText(/cancel it in store settings/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('delete-account-continue'));
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('delete-account-confirm'));
    expect(await screen.findByText('Account deleted')).toBeTruthy();
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  test('cancel at the first confirm does nothing', async () => {
    const deleteAccount = jest.fn();
    signInAs(linkedUser('email'));
    useAuthStore.setState({ deleteAccount });
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByTestId('delete-account'));
    fireEvent.press(screen.getByTestId('delete-account-cancel'));
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  test('a failure shows friendly copy, never the raw error (A22)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deleteAccount = jest.fn(async () => {
      throw new Error('Edge Function returned a non-2xx status code: Server misconfigured');
    });
    signInAs(linkedUser('email'));
    useAuthStore.setState({ deleteAccount });
    renderApp(routes, '/account');
    fireEvent.press(await screen.findByTestId('delete-account'));
    fireEvent.press(screen.getByTestId('delete-account-continue'));
    fireEvent.press(screen.getByTestId('delete-account-confirm'));
    expect(await screen.findByText('Could not delete account')).toBeTruthy();
    expect(screen.getByText("Couldn't delete your account. Try again in a moment.")).toBeTruthy();
    expect(screen.queryByText(/Server misconfigured/)).toBeNull();
    // The raw error goes to the dev log only.
    expect(warn).toHaveBeenCalledWith('[account] delete failed', expect.any(Error));
    warn.mockRestore();
  });
});
