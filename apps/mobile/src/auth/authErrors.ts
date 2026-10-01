/**
 * User-facing copy for auth failures. Supabase, Google and Apple error messages are written for
 * developers ("Database error saving new user", "Unacceptable audience in id_token"), so we never
 * show them as-is. Pure: no React Native imports, so it's unit tested.
 */

type AuthErrorLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export type AuthErrorContext = 'sign_in' | 'sign_up' | 'google' | 'apple' | 'password' | 'link';

export const AUTH_UNAVAILABLE_MESSAGE = "Sign-in isn't available right now. Try again later.";

const NETWORK_MESSAGE = "Couldn't reach MuscleOS. Check your internet connection and try again.";

const FALLBACK: Record<AuthErrorContext, string> = {
  sign_in: 'Something went wrong signing in. Try again in a moment.',
  sign_up: 'Something went wrong creating your account. Try again in a moment.',
  google: "Couldn't sign in with Google. Try again, or use another sign-in option.",
  apple: "Couldn't sign in with Apple. Try again, or use another sign-in option.",
  password: "Couldn't update your password. Try again in a moment.",
  link: "Couldn't open that link. Request a new one from the app.",
};

export function friendlyAuthError(error: AuthErrorLike, context: AuthErrorContext): string {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();

  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('already been used')) {
    return 'This link has expired or was already used. Request a new one from the app.';
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return "That email and password don't match. Check them, or use Forgot password.";
  }
  if (code === 'weak_password' || msg.includes('password should be at least') || msg.includes('password is too weak')) {
    return 'Use a password with at least 6 characters.';
  }
  if (code === 'same_password' || msg.includes('should be different from the old password')) {
    return 'Choose a password different from your current one.';
  }
  if (
    code === 'email_address_invalid' ||
    code === 'validation_failed' ||
    msg.includes('unable to validate email') ||
    msg.includes('invalid format') ||
    (msg.includes('email address') && msg.includes('invalid'))
  ) {
    return 'Enter a valid email address.';
  }
  if (
    error?.status === 429 ||
    code.startsWith('over_') ||
    msg.includes('rate limit') ||
    msg.includes('for security purposes')
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (msg.includes('error sending') || code === 'email_send_failed') {
    return context === 'password'
      ? "We couldn't send the email. Try again in a few minutes."
      : "We couldn't send the confirmation email. Try again in a few minutes.";
  }
  if (code === 'signup_disabled' || msg.includes('signups not allowed')) {
    return "New accounts can't be created right now. Try again later.";
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'That took too long. Check your internet connection and try again.';
  }
  if (
    error?.name === 'AuthRetryableFetchError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  ) {
    return NETWORK_MESSAGE;
  }
  return FALLBACK[context];
}
