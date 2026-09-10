import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  dismissWorkoutLiveAlert,
  hideWorkoutLiveNotification,
  isWorkoutLiveNotificationAvailable,
  showWorkoutLiveNotification,
} from '../../modules/workout-live-notification';
import { useActiveWorkoutStore, type RestAfter } from '@/store/activeWorkoutStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { maybePromptForExactAlarms } from '@/utils/exactAlarmPermission';
import type { WorkoutSession } from '@muscleos/types';

const WORKOUT_NOTIFICATION_ID = 'active-workout';
const REST_COMPLETE_NOTIFICATION_ID = 'rest-complete';
/**
 * Android freezes a channel's sound, importance and vibration at creation time, so
 * changing any of them requires a new id. Keep these versioned.
 */
const WORKOUT_CHANNEL_ID = 'workout_fallback_v1';
const REST_COMPLETE_CHANNEL_ID = 'rest_complete_fallback_v1';
/**
 * Registered via the expo-notifications plugin, which copies it to Android's res/raw.
 * Resource names allow only lowercase letters, digits and underscores.
 */
const REST_END_SOUND = 'rest_end_alert.wav';
const FOREGROUND_REFRESH_MS = 1000;

/** Android posts an ongoing notification the platform ticks itself; iOS cannot. */
const useNativeLiveNotification = isWorkoutLiveNotificationAvailable;
/**
 * Fallback path only. Android replaces an ongoing notification in place, so a per-second
 * countdown is cheap. On iOS every update rewrites the Notification Center entry, so show
 * the clock time rest ends instead — it never goes stale and costs one write.
 */
const canTickTrayCountdown = Platform.OS === 'android';

function formatRestCountdown(restEndTime: number): string {
  const sec = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRestEndClock(restEndTime: number): string {
  return new Date(restEndTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

type NotificationCopy = {
  restBody: string;
  idleBody: string;
  alertBody: string;
};

function hasIncompleteSets(se: WorkoutSession['exercises'][number] | undefined): boolean {
  return !!se && se.sets.some((s) => !s.completed);
}

/**
 * Rest always starts after a working set, including the last one. Name the
 * upcoming work — not the exercise whose sets are already done.
 */
function getWorkoutNotificationCopy(
  session: WorkoutSession,
  restAfter: RestAfter | null
): NotificationCopy {
  const getExercise = useExercisesStore.getState().getExercise;
  const nameOf = (exerciseId: string) => getExercise(exerciseId)?.name ?? exerciseId;

  const forExercise = (name: string, advancing: boolean): NotificationCopy =>
    advancing
      ? {
          restBody: `Continue to ${name}`,
          idleBody: `Continue to ${name}`,
          alertBody: `Time for ${name}`,
        }
      : {
          restBody: `Next: ${name}`,
          idleBody: `Next: ${name}`,
          alertBody: `Time for ${name}`,
        };

  const done: NotificationCopy = {
    restBody: 'Finish your workout',
    idleBody: 'Finish your workout',
    alertBody: 'Time to finish your workout',
  };

  const findIncompleteFrom = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      const se = session.exercises[i];
      if (hasIncompleteSets(se)) return se;
    }
    return undefined;
  };

  if (restAfter != null) {
    const current = session.exercises[restAfter.exIdx];
    if (hasIncompleteSets(current)) {
      return forExercise(nameOf(current.exerciseId), false);
    }
    const next =
      findIncompleteFrom(restAfter.exIdx + 1, session.exercises.length) ??
      findIncompleteFrom(0, restAfter.exIdx);
    if (next) return forExercise(nameOf(next.exerciseId), true);
    return done;
  }

  const next = findIncompleteFrom(0, session.exercises.length);
  if (next) return forExercise(nameOf(next.exerciseId), false);
  return done;
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(WORKOUT_CHANNEL_ID, {
      name: 'Active workout',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      sound: null,
    }),
    Notifications.setNotificationChannelAsync(REST_COMPLETE_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 100, 250],
      sound: REST_END_SOUND,
      enableVibrate: true,
    }),
  ]);
}

async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function showWorkoutNotification(title: string, body: string) {
  const granted = await requestPermission();
  if (!granted) return;
  await ensureChannels();
  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: { screen: 'active-workout', type: 'workout-status' },
    ...(Platform.OS === 'android'
      ? {
          channelId: WORKOUT_CHANNEL_ID,
          sticky: true,
        }
      : {}),
  };
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
    identifier: WORKOUT_NOTIFICATION_ID,
  });
}

async function updateWorkoutNotification(title: string, body: string) {
  // Same identifier replaces the existing tray entry (no dismiss flicker).
  await showWorkoutNotification(title, body);
}

async function dismissWorkoutNotification() {
  try {
    await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID);
  } catch {
    // ignore
  }
}

async function cancelRestCompleteNotification() {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_COMPLETE_NOTIFICATION_ID);
  } catch {
    // ignore
  }
  try {
    await Notifications.dismissNotificationAsync(REST_COMPLETE_NOTIFICATION_ID);
  } catch {
    // ignore
  }
}

/**
 * System-scheduled alert so rest end still plays when JS is suspended
 * (app backgrounded / screen locked). Cancelled while the app is active
 * so the in-app sound path handles the foreground case.
 */
async function scheduleRestCompleteNotification(
  restEndTime: number,
  alertBody: string,
  playSound: boolean
) {
  const seconds = Math.ceil((restEndTime - Date.now()) / 1000);
  if (seconds < 1) return;

  const granted = await requestPermission();
  if (!granted) return;
  await ensureChannels();
  await cancelRestCompleteNotification();

  const content: Notifications.NotificationContentInput = {
    title: 'Rest over',
    body: alertBody,
    data: { screen: 'active-workout', type: 'rest-complete' },
    sound: playSound ? REST_END_SOUND : false,
    ...(Platform.OS === 'ios'
      ? { interruptionLevel: 'timeSensitive' as const }
      : {
          channelId: REST_COMPLETE_CHANNEL_ID,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
  };

  await Notifications.scheduleNotificationAsync({
    content,
    identifier: REST_COMPLETE_NOTIFICATION_ID,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(restEndTime),
      ...(Platform.OS === 'android' ? { channelId: REST_COMPLETE_CHANNEL_ID } : {}),
    },
  });
}

export function useWorkoutNotification() {
  const session = useActiveWorkoutStore((s) => s.session);
  const restEndTime = useActiveWorkoutStore((s) => s.restEndTime);
  const restAfter = useActiveWorkoutStore((s) => s.restAfter);
  const restTotalSeconds = useActiveWorkoutStore((s) => s.restTotalSeconds);
  const workoutSoundsEnabled = useSettingsStore((s) => s.workoutSoundsEnabled);
  const remainingSetsSignature =
    session?.exercises.map((se) => se.sets.filter((s) => !s.completed).length).join(',') ?? '';
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!session) {
      if (useNativeLiveNotification) {
        void hideWorkoutLiveNotification();
      } else {
        void dismissWorkoutNotification();
        void cancelRestCompleteNotification();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const copy = getWorkoutNotificationCopy(session, restAfter);

    if (useNativeLiveNotification) {
      let disposed = false;

      const resting = restEndTime != null && restEndTime > Date.now();

      const syncNative = async (appState: AppStateStatus) => {
        const granted = await requestPermission();
        if (!granted || disposed) return;
        if (resting) void maybePromptForExactAlarms();
        await showWorkoutLiveNotification({
          restTitle: 'Resting',
          restBody: copy.restBody,
          idleTitle: 'Workout in progress',
          idleBody: copy.idleBody,
          restEndTime: resting ? restEndTime : null,
          alertTitle: 'Rest over',
          alertBody: copy.alertBody,
          // In the foreground the in-app sound handles it, so skip the OS alert.
          alertEnabled: appState !== 'active',
          alertSound: workoutSoundsEnabled,
        });
      };

      void syncNative(appStateRef.current);

      const nativeSub = AppState.addEventListener('change', (nextState) => {
        appStateRef.current = nextState;
        if (nextState === 'active') {
          void dismissWorkoutLiveAlert();
        }
        void syncNative(nextState);
      });

      return () => {
        disposed = true;
        nativeSub.remove();
      };
    }

    function buildNotification(preferAbsoluteRestTime: boolean) {
      const title = 'MuscleOS — Workout';
      if (restEndTime != null && restEndTime > Date.now()) {
        if (preferAbsoluteRestTime) {
          return {
            title,
            body: `Rest until ${formatRestEndClock(restEndTime)} • ${copy.restBody}`,
          };
        }
        return {
          title,
          body: `Rest ${formatRestCountdown(restEndTime)} • ${copy.restBody}`,
        };
      }
      return { title, body: copy.idleBody };
    }

    function clearRefreshInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    async function refresh(preferAbsoluteRestTime: boolean) {
      const { title, body } = buildNotification(preferAbsoluteRestTime);
      await updateWorkoutNotification(title, body);
    }

    async function syncRestCompleteSchedule(appState: AppStateStatus) {
      const resting = restEndTime != null && restEndTime > Date.now();
      if (!resting) {
        await cancelRestCompleteNotification();
        return;
      }
      // Foreground: in-app timer + sounds. Background: OS fires the alert.
      if (appState === 'active') {
        await cancelRestCompleteNotification();
        return;
      }
      await scheduleRestCompleteNotification(
        restEndTime!,
        copy.alertBody,
        workoutSoundsEnabled
      );
    }

    function startForegroundRefresh() {
      clearRefreshInterval();
      if (!canTickTrayCountdown) return;
      if (restEndTime == null || restEndTime <= Date.now()) return;
      intervalRef.current = setInterval(() => {
        void refresh(false);
      }, FOREGROUND_REFRESH_MS);
    }

    const isActive = appStateRef.current === 'active';
    void refresh(!isActive || !canTickTrayCountdown);
    void syncRestCompleteSchedule(appStateRef.current);
    if (isActive) startForegroundRefresh();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        clearRefreshInterval();
        void cancelRestCompleteNotification();
        void refresh(!canTickTrayCountdown);
        startForegroundRefresh();
        return;
      }

      // Leaving foreground: freeze tray on an absolute end time and arm the OS alert.
      if (prev === 'active' && nextState.match(/inactive|background/)) {
        clearRefreshInterval();
        void refresh(true);
        void syncRestCompleteSchedule(nextState);
      }
    });

    return () => {
      clearRefreshInterval();
      appStateSub.remove();
    };
  }, [
    session?.id,
    session?.exercises?.length,
    restEndTime,
    restAfter?.exIdx,
    restAfter?.setIdx,
    remainingSetsSignature,
    restTotalSeconds,
    workoutSoundsEnabled,
  ]);
}
