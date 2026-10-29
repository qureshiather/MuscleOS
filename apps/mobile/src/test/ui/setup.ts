/**
 * Global Jest setup for UI tests. Swaps native modules the renderer can't load for in-memory or
 * no-op stand-ins. Per-test behaviour (sessions, templates, settings, etc.) is set through the real Zustand
 * stores — see src/test/ui/render.tsx.
 */
import { installConsoleGuard } from '../consoleGuard';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

// Workout share image: capture returns a temp file, the OS share sheet is a no-op.
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///tmp/share.png'),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  dismissNotificationAsync: jest.fn(async () => undefined),
  dismissAllNotificationsAsync: jest.fn(async () => undefined),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
}));

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn(), pause: jest.fn() }),
  createAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn(), pause: jest.fn(), remove: jest.fn() }),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

// Fail a test on unexpected console.error/warn (act warnings, app logging, deprecations). Tests
// that deliberately trigger logging spy on the console themselves.
installConsoleGuard(afterEach, [
  // react-native-draggable-flatlist 4.0.3 (latest; unreleased since 2025) still calls
  // InteractionManager, which RN 0.86 deprecates with a warning on first use.
  /^InteractionManager has been deprecated/,
]);
