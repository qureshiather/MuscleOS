import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';

const WORKOUT_NOTIFICATION_ID = 'active-workout';
const REST_COMPLETE_NOTIFICATION_ID = 'rest-complete';
const WORKOUT_CHANNEL_ID = 'workout';
const REST_COMPLETE_CHANNEL_ID = 'rest-complete';
/** Custom sound registered via expo-notifications plugin (filename only). */
const REST_END_SOUND = 'rest-end.wav';
const FOREGROUND_REFRESH_MS = 1000;

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
  exerciseName: string,
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
    body: `Time for ${exerciseName}`,
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!session) {
      void dismissWorkoutNotification();
      void cancelRestCompleteNotification();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const currentSession = session;

    function getCurrentExerciseName(): string {
      const getExercise = useExercisesStore.getState().getExercise;
      if (restAfter != null) {
        const se = currentSession.exercises[restAfter.exIdx];
        if (se) return getExercise(se.exerciseId)?.name ?? se.exerciseId;
      }
      const next = currentSession.exercises.find((se) =>
        se.sets.some((s) => !s.completed)
      );
      if (next) return getExercise(next.exerciseId)?.name ?? next.exerciseId;
      return 'Workout';
    }

    function buildNotification(preferAbsoluteRestTime: boolean) {
      const exerciseName = getCurrentExerciseName();
      const title = 'MuscleOS — Workout';
      if (restEndTime != null && restEndTime > Date.now()) {
        if (preferAbsoluteRestTime) {
          return {
            title,
            body: `Rest until ${formatRestEndClock(restEndTime)} • ${exerciseName}`,
          };
        }
        return {
          title,
          body: `Rest ${formatRestCountdown(restEndTime)} • ${exerciseName}`,
        };
      }
      return { title, body: `Next: ${exerciseName}` };
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
        getCurrentExerciseName(),
        workoutSoundsEnabled
      );
    }

    function startForegroundRefresh() {
      clearRefreshInterval();
      if (restEndTime == null || restEndTime <= Date.now()) return;
      intervalRef.current = setInterval(() => {
        void refresh(false);
      }, FOREGROUND_REFRESH_MS);
    }

    const isActive = appStateRef.current === 'active';
    void refresh(!isActive);
    void syncRestCompleteSchedule(appStateRef.current);
    if (isActive) startForegroundRefresh();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        clearRefreshInterval();
        void cancelRestCompleteNotification();
        void refresh(false);
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
    restTotalSeconds,
    workoutSoundsEnabled,
  ]);
}
