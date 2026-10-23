import { beforeEach, describe, expect, it, vi } from 'vitest';

/** docs/features/workout-logging.md#notifications — the Alarms & reminders explanation (MUS-167). */

const native = vi.hoisted(() => ({
  available: true,
  canSchedule: vi.fn(async () => false),
  openSettings: vi.fn(async () => undefined),
}));
vi.mock('../../modules/workout-live-notification', () => ({
  get isWorkoutLiveNotificationAvailable() {
    return native.available;
  },
  canScheduleExactAlarms: native.canSchedule,
  openExactAlarmSettings: native.openSettings,
}));

async function load() {
  vi.resetModules();
  return import('./exactAlarmPermission');
}

beforeEach(async () => {
  vi.clearAllMocks();
  native.available = true;
  native.canSchedule.mockResolvedValue(false);
  (await import('@/test/mocks/asyncStorage')).__resetAsyncStorage();
});

describe('maybePromptForExactAlarms', () => {
  it('explains the rest timer in the themed dialog before any system screen', async () => {
    const m = await load();
    await m.maybePromptForExactAlarms();
    expect(m.useExactAlarmPromptStore.getState().visible).toBe(true);
    expect(m.EXACT_ALARM_PROMPT.message).toContain('only for your rest timer');
    expect(native.openSettings).not.toHaveBeenCalled();
  });

  it('opens settings only from Open settings; Not now just closes', async () => {
    const m = await load();
    await m.maybePromptForExactAlarms();
    m.answerExactAlarmPrompt(false);
    expect(m.useExactAlarmPromptStore.getState().visible).toBe(false);
    expect(native.openSettings).not.toHaveBeenCalled();
    m.useExactAlarmPromptStore.setState({ visible: true });
    m.answerExactAlarmPrompt(true);
    expect(native.openSettings).toHaveBeenCalledTimes(1);
  });

  it('asks once per launch, and once ever', async () => {
    const m = await load();
    await m.maybePromptForExactAlarms();
    m.answerExactAlarmPrompt(false);
    await m.maybePromptForExactAlarms();
    expect(m.useExactAlarmPromptStore.getState().visible).toBe(false);

    const next = await load();
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('muscleos_exact_alarm_prompt_shown', 'true');
    await next.maybePromptForExactAlarms();
    expect(next.useExactAlarmPromptStore.getState().visible).toBe(false);
  });

  it('never asks when already allowed, or without the native module (iOS)', async () => {
    native.canSchedule.mockResolvedValue(true);
    let m = await load();
    await m.maybePromptForExactAlarms();
    expect(m.useExactAlarmPromptStore.getState().visible).toBe(false);

    native.available = false;
    native.canSchedule.mockResolvedValue(false);
    m = await load();
    await m.maybePromptForExactAlarms();
    expect(m.useExactAlarmPromptStore.getState().visible).toBe(false);
  });
});
