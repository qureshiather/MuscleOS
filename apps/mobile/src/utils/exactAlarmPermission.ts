import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/storage/keys';
import {
  canScheduleExactAlarms,
  isWorkoutLiveNotificationAvailable,
  openExactAlarmSettings,
} from '../../modules/workout-live-notification';

let askedThisLaunch = false;

/**
 * Android 13+ denies "Alarms & reminders" by default, which downgrades the rest-over
 * alert to an inexact alarm the system can defer by up to about a minute. Ask once,
 * the first time a rest timer runs, then never again.
 */
export async function maybePromptForExactAlarms(): Promise<void> {
  if (!isWorkoutLiveNotificationAvailable || askedThisLaunch) return;
  askedThisLaunch = true;

  if (await canScheduleExactAlarms()) return;

  const alreadyAsked = await AsyncStorage.getItem(STORAGE_KEYS.exactAlarmPromptShown);
  if (alreadyAsked) return;
  await AsyncStorage.setItem(STORAGE_KEYS.exactAlarmPromptShown, 'true');

  Alert.alert(
    'Let rest alerts fire on time',
    'Android needs the "Alarms & reminders" permission to alert you the moment your rest ends. Without it the alert can arrive up to a minute late.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => void openExactAlarmSettings() },
    ]
  );
}
