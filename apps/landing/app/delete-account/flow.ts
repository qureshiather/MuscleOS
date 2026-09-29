/** Pure helpers for the web account-deletion flow. No Supabase or DOM access here. */

/** Seconds before the page lets the same browser request another code. Matches Supabase's per-address interval. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Wrong codes allowed before the page asks for a fresh one. Supabase also rate limits verification per IP. */
export const MAX_CODE_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return EMAIL_RE.test(email) ? email : null;
}

/** Supabase email OTPs are 6 digits by default; accept up to 10 in case the project length changes. */
export function normalizeCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, '');
  return /^\d{6,10}$/.test(code) ? code : null;
}

export type SendOutcome = 'sent' | 'rate_limited' | 'failed';

/**
 * Map a `signInWithOtp` result to what the page shows. An unknown address (`otp_disabled` /
 * "Signups not allowed") is reported as `sent`, so the page never reveals whether an account exists.
 */
export function sendOutcome(error: { status?: number; code?: string } | null): SendOutcome {
  if (!error) return 'sent';
  if (error.status === 429 || error.code?.startsWith('over_')) return 'rate_limited';
  if (error.code === 'otp_disabled' || error.code === 'user_not_found' || error.status === 422) {
    return 'sent';
  }
  return 'failed';
}

export type VerifyOutcome = 'verified' | 'invalid_code' | 'rate_limited' | 'failed';

export function verifyOutcome(error: { status?: number; code?: string } | null): VerifyOutcome {
  if (!error) return 'verified';
  if (error.status === 429 || error.code?.startsWith('over_')) return 'rate_limited';
  if (error.code === 'otp_expired' || error.status === 401 || error.status === 403) {
    return 'invalid_code';
  }
  return 'failed';
}
