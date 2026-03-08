import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useExercisesStore } from '@/store/exercisesStore';

const NOTIFICATION_IDENTIFIER = 'active-workout';
const WORKOUT_CHANNEL_ID = 'workout';
const REFRESH_INTERVAL_MS = 15000;

function formatRestTime(restEndTime: number): string {
  const sec = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(WORKOUT_CHANNEL_ID, {
      name: 'Active workout',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      sound: null,
    });
  }
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
  await ensureChannel();
  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: { screen: 'active-workout' },
    ...(Platform.OS === 'android' && { channelId: WORKOUT_CHANNEL_ID }),
  };
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
    identifier: NOTIFICATION_IDENTIFIER,
  });
}

async function updateWorkoutNotification(title: string, body: string) {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_IDENTIFIER);
  } catch {
    // ignore
  }
  await showWorkoutNotification(title, body);
}

async function dismissWorkoutNotification() {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_IDENTIFIER);
  } catch {
    // ignore
  }
}

export function useWorkoutNotification() {
  const session = useActiveWorkoutStore((s) => s.session);
  const restEndTime = useActiveWorkoutStore((s) => s.restEndTime);
  const restAfter = useActiveWorkoutStore((s) => s.restAfter);
  const restTotalSeconds = useActiveWorkoutStore((s) => s.restTotalSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) {
      dismissWorkoutNotification();
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

    function buildNotification() {
      const exerciseName = getCurrentExerciseName();
      const title = 'MuscleOS — Workout';
      if (restEndTime != null && restEndTime > Date.now()) {
        const timeStr = formatRestTime(restEndTime);
        return { title, body: `Rest ${timeStr} • ${exerciseName}` };
      }
      return { title, body: `Next: ${exerciseName}` };
    }

    async function refresh() {
      const { title, body } = buildNotification();
      await updateWorkoutNotification(title, body);
    }

    refresh();

    if (restEndTime != null && restEndTime > Date.now()) {
      intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [
    session?.id,
    session?.exercises?.length,
    restEndTime,
    restAfter?.exIdx,
    restAfter?.setIdx,
    restTotalSeconds,
  ]);
}
