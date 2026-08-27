import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type WorkoutLiveNotificationInput = {
  /** Shown while resting, next to the system-rendered countdown. */
  restTitle: string;
  restBody: string;
  /** Shown when not resting, including after the rest alarm fires. */
  idleTitle: string;
  idleBody: string;
  /** Epoch ms when rest ends, or null when not resting. */
  restEndTime: number | null;
  alertTitle: string;
  alertBody: string;
  /** False while the app is in the foreground, where in-app sound handles it. */
  alertEnabled: boolean;
  /** Mirrors the in-app workout sounds setting. */
  alertSound: boolean;
};

type WorkoutLiveNotificationNativeModule = {
  show(input: WorkoutLiveNotificationInput): Promise<void>;
  hide(): Promise<void>;
  dismissAlert(): Promise<void>;
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
};

const nativeModule = requireOptionalNativeModule<WorkoutLiveNotificationNativeModule>(
  'WorkoutLiveNotification'
);

/**
 * Android-only ongoing workout notification with a countdown the platform ticks
 * itself, plus an exact alarm for the rest-over alert. Absent in Expo Go and on iOS.
 */
export const isWorkoutLiveNotificationAvailable =
  Platform.OS === 'android' && nativeModule != null;

export async function showWorkoutLiveNotification(
  input: WorkoutLiveNotificationInput
): Promise<void> {
  await nativeModule?.show(input);
}

export async function hideWorkoutLiveNotification(): Promise<void> {
  await nativeModule?.hide();
}

export async function dismissWorkoutLiveAlert(): Promise<void> {
  await nativeModule?.dismissAlert();
}

/**
 * Android 13+ denies "Alarms & reminders" by default. Without it the rest-over alert
 * is downgraded to an inexact alarm and can be deferred by up to about a minute.
 */
export async function canScheduleExactAlarms(): Promise<boolean> {
  return (await nativeModule?.canScheduleExactAlarms()) ?? true;
}

export async function openExactAlarmSettings(): Promise<void> {
  await nativeModule?.openExactAlarmSettings();
}
