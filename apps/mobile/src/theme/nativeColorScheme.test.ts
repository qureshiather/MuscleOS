import { describe, expect, it } from 'vitest';
import { nativeColorScheme } from './nativeColorScheme';

describe('nativeColorScheme', () => {
  it('pins the OS scheme to a fixed theme and releases it for Auto', () => {
    expect(nativeColorScheme('dark')).toBe('dark');
    expect(nativeColorScheme('light')).toBe('light');
    expect(nativeColorScheme('auto')).toBe('unspecified');
  });
});
