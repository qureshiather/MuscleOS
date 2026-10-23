import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { STORAGE_KEYS } from '@/storage/keys';
import {
  canScheduleExactAlarms,
  isWorkoutLiveNotificationAvailable,
  openExactAlarmSettings,
} from '../../modules/workout-live-notification';

/** The themed explanation shown before sending anyone to Android's permission screen. */
export const EXACT_ALARM_PROMPT = {
  title: 'Rest timer alerts',
  message:
    'MuscleOS uses Android\'s "Alarms & reminders" permission only for your rest timer, so it can alert you the moment your rest ends, even with the screen off. Without it the alert can arrive up to a minute late.',
  cancelLabel: 'Not now',
  confirmLabel: 'Open settings',
} as const;

/** Whether the explanation is showing; `ExactAlarmPrompt` renders it. */
export const useExactAlarmPromptStore = create<{ visible: boolean }>(() => ({ visible: false }));

let askedThisLaunch = false;

/**
 * Android 13+ denies "Alarms & reminders" by default, which downgrades the rest-over
 * alert to an inexact alarm the system can defer by up to about a minute. Explain why once, the
 * first time a rest timer runs, then never again; the system screen only opens if the user asks.
 */
export async function maybePromptForExactAlarms(): Promise<void> {
  if (!isWorkoutLiveNotificationAvailable || askedThisLaunch) return;
  askedThisLaunch = true;

  if (await canScheduleExactAlarms()) return;

  const alreadyAsked = await AsyncStorage.getItem(STORAGE_KEYS.exactAlarmPromptShown);
  if (alreadyAsked) return;
  await AsyncStorage.setItem(STORAGE_KEYS.exactAlarmPromptShown, 'true');

  useExactAlarmPromptStore.setState({ visible: true });
}

/** The explanation's buttons: Open settings goes to the system screen; both close it. */
export function answerExactAlarmPrompt(openSettings: boolean): void {
  useExactAlarmPromptStore.setState({ visible: false });
  if (openSettings) void openExactAlarmSettings();
}
