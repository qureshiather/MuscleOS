import { describe, expect, it } from 'vitest';
import { normalizeCode, normalizeEmail, sendOutcome, verifyOutcome } from './flow';

describe('normalizeEmail', () => {
  it('trims and lowercases a valid address', () => {
    expect(normalizeEmail('  Lifter@Example.COM ')).toBe('lifter@example.com');
  });

  it('rejects empty, malformed, and oversized input', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('a b@example.com')).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});

describe('normalizeCode', () => {
  it('accepts 6–10 digits, ignoring spaces', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('12345678')).toBe('12345678');
  });

  it('rejects short, long, and non-numeric codes', () => {
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('12345678901')).toBeNull();
    expect(normalizeCode('12a456')).toBeNull();
  });
});

describe('sendOutcome', () => {
  it('reports success and hides whether the account exists', () => {
    expect(sendOutcome(null)).toBe('sent');
    expect(sendOutcome({ status: 422, code: 'otp_disabled' })).toBe('sent');
  });

  it('surfaces rate limits', () => {
    expect(sendOutcome({ status: 429, code: 'over_email_send_rate_limit' })).toBe('rate_limited');
    expect(sendOutcome({ code: 'over_request_rate_limit' })).toBe('rate_limited');
  });

  it('treats anything else as a failure', () => {
    expect(sendOutcome({ status: 500 })).toBe('failed');
  });
});

describe('verifyOutcome', () => {
  it('maps expired or wrong codes, rate limits, and other errors', () => {
    expect(verifyOutcome(null)).toBe('verified');
    expect(verifyOutcome({ status: 403, code: 'otp_expired' })).toBe('invalid_code');
    expect(verifyOutcome({ status: 429 })).toBe('rate_limited');
    expect(verifyOutcome({ status: 500 })).toBe('failed');
  });
});
