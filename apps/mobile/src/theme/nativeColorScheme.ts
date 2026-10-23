import type { ThemePreference } from '@/storage/localStorage';

/**
 * The colour scheme handed to the OS (`Appearance.setColorScheme`), so system UI drawn outside
 * React — Android's navigation bar buttons, iOS alerts and keyboards — matches the app's theme
 * rather than the phone's. Auto hands control back to the device.
 */
export function nativeColorScheme(preference: ThemePreference): 'light' | 'dark' | 'unspecified' {
  return preference === 'auto' ? 'unspecified' : preference;
}
