/** Supabase email links (confirm + password recovery) land on the app or the website. */
export const EMAIL_AUTH_REDIRECT = 'https://muscleos.app/auth/confirm';
export const APP_AUTH_CALLBACK = 'muscleos://auth-callback';

export type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

export type EmailCallback =
  | { kind: 'otp'; tokenHash: string; otpType: EmailOtpType }
  | { kind: 'code'; code: string; linkType: string | null }
  | { kind: 'session'; accessToken: string; refreshToken: string; linkType: string | null };

const OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function isOtpType(value: string | null): value is EmailOtpType {
  return value != null && OTP_TYPES.has(value as EmailOtpType);
}

/** Query string plus hash, so implicit tokens and token_hash links both parse. */
export function authLinkParams(url: string): URLSearchParams {
  const query = url.includes('?') ? (url.split('?')[1]?.split('#')[0] ?? '') : '';
  const hash = url.includes('#') ? (url.split('#')[1] ?? '') : '';
  const params = new URLSearchParams(query);
  for (const [key, value] of new URLSearchParams(hash)) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}

export function parseEmailCallback(url: string): EmailCallback | null {
  if (!url.includes('auth-callback') && !url.includes('auth/confirm') && !url.includes('token_hash') && !url.includes('access_token')) {
    return null;
  }
  const params = authLinkParams(url);
  const linkType = params.get('type');
  const tokenHash = params.get('token_hash');
  if (tokenHash && isOtpType(linkType)) {
    return { kind: 'otp', tokenHash, otpType: linkType };
  }
  const code = params.get('code');
  if (code) return { kind: 'code', code, linkType };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken, linkType };
  }
  return null;
}

export function emailCallbackNeedsNewPassword(callback: EmailCallback | null): boolean {
  if (!callback) return false;
  if (callback.kind === 'otp') return callback.otpType === 'recovery';
  return callback.linkType === 'recovery';
}
