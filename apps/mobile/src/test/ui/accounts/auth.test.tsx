import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import AuthScreen from '../../../../app/auth';
import AuthEmailScreen from '../../../../app/auth-email';
import AuthNewPasswordScreen from '../../../../app/auth-new-password';
import AuthCallbackScreen from '../../../../app/auth-callback';
import { AUTH_CALLBACK_FALLBACK_MS } from '@/auth/emailCallback';
import { renderApp, resetAppState, routeStub } from '../render';
import { linkedUser, signInAs } from './helpers';

/** docs/features/accounts-and-data.md#authentication — sign-in screens and the email-link route. */

const mockSignIn = {
  signInWithApple: jest.fn(async () => false),
  signInWithGoogle: jest.fn(async () => false),
  signInWithEmailOnly: jest.fn(async (): Promise<boolean | 'confirm'> => false),
  linkWithEmail: jest.fn(async (): Promise<boolean | 'confirm'> => false),
  sendPasswordReset: jest.fn(async (): Promise<boolean | 'missing'> => true),
};
jest.mock('@/auth/signIn', () => ({ useSignIn: () => mockSignIn }));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      signInWithPassword: jest.fn(async () => ({ error: null })),
      updateUser: jest.fn(async () => ({ error: null })),
      onAuthStateChange: jest.fn(),
    },
  },
}));
const { supabase } = jest.requireMock('@/lib/supabase') as {
  supabase: { auth: { signInWithPassword: jest.Mock; updateUser: jest.Mock } };
};

const routes = {
  auth: AuthScreen,
  'auth-email': AuthEmailScreen,
  'auth-new-password': AuthNewPasswordScreen,
  'auth-callback': AuthCallbackScreen,
  '(tabs)/index': routeStub('tabs'),
};

let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  await resetAppState();
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alertSpy.mockRestore());

describe('/auth method picker', () => {
  test('says why to sign in; Google and Email; no Apple off iOS-native', async () => {
    renderApp(routes, '/auth');
    expect(await screen.findByText('Link an account to back up your data and restore Pro on any device.')).toBeTruthy();
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    fireEvent.press(screen.getByText('Continue with Email'));
    expect(await screen.findByText('If you already used Apple or Google with this email, this is the same account.')).toBeTruthy();
  });

  test('a successful Google sign-in goes to the tabs; a failed one stays', async () => {
    renderApp(routes, '/auth');
    fireEvent.press(await screen.findByText('Continue with Google'));
    await waitFor(() => expect(mockSignIn.signInWithGoogle).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText('route:tabs')).toBeNull();
    mockSignIn.signInWithGoogle.mockResolvedValueOnce(true);
    fireEvent.press(screen.getByText('Continue with Google'));
    expect(await screen.findByText('route:tabs')).toBeTruthy();
  });
});

describe('/auth-email', () => {
  test('sign in needs an email and a 6+ character password, then goes to the tabs', async () => {
    mockSignIn.signInWithEmailOnly.mockResolvedValueOnce(true);
    renderApp(routes, '/auth-email');
    fireEvent.changeText(await screen.findByPlaceholderText('Email'), ' sam@example.com ');
    fireEvent.changeText(screen.getByPlaceholderText('Password (min 6 characters)'), '12345');
    const submit = screen.getAllByText('Sign in').at(-1)!;
    fireEvent.press(submit);
    expect(mockSignIn.signInWithEmailOnly).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText('Password (min 6 characters)'), '123456');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);
    await waitFor(() => expect(mockSignIn.signInWithEmailOnly).toHaveBeenCalledWith('sam@example.com', '123456'));
    expect(await screen.findByText('route:tabs')).toBeTruthy();
  });

  test('an unconfirmed address shows the confirm-your-email dialog', async () => {
    mockSignIn.signInWithEmailOnly.mockResolvedValueOnce('confirm');
    renderApp(routes, '/auth-email');
    fireEvent.changeText(await screen.findByPlaceholderText('Email'), 'sam@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password (min 6 characters)'), '123456');
    fireEvent.press(screen.getAllByText('Sign in').at(-1)!);
    expect(await screen.findByText('Confirm your email')).toBeTruthy();
    expect(
      screen.getByText('We sent you a confirmation link. Open it to activate your account, then come back and sign in.')
    ).toBeTruthy();
  });

  test('create account asks for the password twice and must match', async () => {
    mockSignIn.linkWithEmail.mockResolvedValueOnce('confirm');
    renderApp(routes, '/auth-email');
    fireEvent.press(await screen.findByText('Create'));
    expect(screen.getByPlaceholderText('Display name (optional)')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password (min 6 characters)'), 'secret1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'secret2');
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Create account').at(-1)!);
    expect(mockSignIn.linkWithEmail).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'secret1');
    fireEvent.press(screen.getAllByText('Create account').at(-1)!);
    await waitFor(() => expect(mockSignIn.linkWithEmail).toHaveBeenCalledWith('new@example.com', 'secret1', undefined));
    expect(await screen.findByText('Confirm your email')).toBeTruthy();
  });

  test('forgot password never says whether the address exists', async () => {
    renderApp(routes, '/auth-email');
    fireEvent.press(await screen.findByText('Forgot password?'));
    expect(screen.getByText('We will email a link to reset the password if the email exists.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'who@example.com');
    fireEvent.press(screen.getByText('Send reset link'));
    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(
      screen.getByText('If an account exists for that email, we sent a reset link. Open it on this phone.')
    ).toBeTruthy();
  });

  test('forgot password: a missing account shows no dialog; a send failure says so', async () => {
    mockSignIn.sendPasswordReset.mockResolvedValueOnce('missing');
    renderApp(routes, '/auth-email');
    fireEvent.press(await screen.findByText('Forgot password?'));
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'who@example.com');
    fireEvent.press(screen.getByText('Send reset link'));
    await waitFor(() => expect(mockSignIn.sendPasswordReset).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText('Check your email')).toBeNull();
    mockSignIn.sendPasswordReset.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByText('Send reset link'));
    expect(await screen.findByText('Could not send reset link')).toBeTruthy();
  });
});

describe('/auth-new-password', () => {
  test('recovery link: requires a matching 6+ character pair, then goes home', async () => {
    renderApp(routes, '/auth-new-password');
    expect(await screen.findByText('New password')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('New password (min 6 characters)'), 'abcdef');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'abcdeg');
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'abcdef');
    fireEvent.press(screen.getByText('Save password'));
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'abcdef' }));
    expect(await screen.findByText('route:tabs')).toBeTruthy();
  });

  test('update errors are shown as friendly copy', async () => {
    supabase.auth.updateUser.mockResolvedValueOnce({
      error: { code: 'same_password', message: 'New password should be different from the old password.' },
    });
    renderApp(routes, '/auth-new-password');
    fireEvent.changeText(await screen.findByPlaceholderText('New password (min 6 characters)'), 'abcdef');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'abcdef');
    fireEvent.press(screen.getByText('Save password'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Could not update password', 'Choose a password different from your current one.')
    );
  });

  test('change mode re-verifies the current password first', async () => {
    signInAs(linkedUser('email', 'sam@example.com'));
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    renderApp(routes, '/auth-new-password?mode=change');
    expect(await screen.findByText('Change password')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Current password'), 'wrong1');
    fireEvent.changeText(screen.getByPlaceholderText('New password (min 6 characters)'), 'abcdef');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'abcdef');
    fireEvent.press(screen.getByText('Save password'));
    await waitFor(() =>
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'sam@example.com', password: 'wrong1' })
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Current password is wrong',
      'Check it and try again, or use Forgot password on the sign-in screen.'
    );
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('/auth-callback (A15)', () => {
  test('email links have a route: a spinner while the link completes', async () => {
    renderApp(routes, '/auth-callback?token_hash=abc&type=signup');
    expect(await screen.findByText('Opening your link…')).toBeTruthy();
    expect(screen.queryByText(/Unmatched/)).toBeNull();
  });

  test('falls back to the tabs if nothing navigates away', async () => {
    jest.useFakeTimers();
    try {
      renderApp(routes, '/auth-callback');
      expect(await screen.findByText('Opening your link…')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(AUTH_CALLBACK_FALLBACK_MS);
      });
      expect(await screen.findByText('route:tabs')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
