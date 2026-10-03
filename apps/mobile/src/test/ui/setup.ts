/**
 * Global Jest setup for UI tests. Swaps native modules the renderer can't load for in-memory or
 * no-op stand-ins. Per-test behaviour (Pro status, sessions, etc.) is set through the real Zustand
 * stores — see src/test/ui/render.tsx.
 */
import { installConsoleGuard } from '../consoleGuard';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
    getOfferings: jest.fn(async () => ({ current: null })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
    logIn: jest.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
    logOut: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG', ERROR: 'ERROR', WARN: 'WARN' },
}));

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
// that deliberately trigger logging spy on the console themselves. No allowlist is needed today.
installConsoleGuard(afterEach);
