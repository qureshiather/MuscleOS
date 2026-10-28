import { describe, expect, it } from 'vitest';
import { formatAppVersion } from './appVersion';

/** docs/features/accounts-and-data.md#about */
describe('formatAppVersion', () => {
  it('shows the version with the build number in brackets', () => {
    expect(formatAppVersion('1.0.0', '42')).toBe('1.0.0 (42)');
  });

  it('drops a missing or blank build number', () => {
    expect(formatAppVersion('1.0.0', null)).toBe('1.0.0');
    expect(formatAppVersion('1.0.0', '  ')).toBe('1.0.0');
  });

  it('falls back when the version is unknown', () => {
    expect(formatAppVersion(null, '42')).toBe('Build 42');
    expect(formatAppVersion(undefined, undefined)).toBe('Unknown');
  });
});
