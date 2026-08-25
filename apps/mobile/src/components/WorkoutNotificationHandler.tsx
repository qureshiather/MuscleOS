import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useWorkoutNotification } from '@/hooks/useWorkoutNotification';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';

function isRestCompleteNotification(
  notification: Notifications.Notification
): boolean {
  const data = notification.request.content.data;
  return (
    notification.request.identifier === 'rest-complete' ||
    data?.type === 'rest-complete'
  );
}

export default function WorkoutNotificationHandler() {
  const router = useRouter();
  useWorkoutNotification();

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const restComplete = isRestCompleteNotification(notification);
        return {
          // Status tray updates stay quiet; rest-complete alerts may sound.
          shouldShowAlert: restComplete || Platform.OS !== 'ios',
          shouldPlaySound: restComplete,
          shouldSetBadge: false,
          shouldShowBanner: restComplete || Platform.OS !== 'ios',
          shouldShowList: true,
        };
      },
    });
  }, []);

  useEffect(() => {
    // Keep rest state in sync if the OS delivered the rest-complete alert
    // while JS was suspended (background / locked).
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      if (!isRestCompleteNotification(notification)) return;
      const { restEndTime, restAfter, restTotalSeconds, recordRestDuration, clearRestTimer } =
        useActiveWorkoutStore.getState();
      if (restEndTime == null) return;
      if (restAfter !== null) {
        recordRestDuration(restAfter.exIdx, restAfter.setIdx, restTotalSeconds);
      }
      clearRestTimer();
    });

    // Cold start: open workout if app was launched from notification tap.
    // getLastNotificationResponseAsync is not available on iOS in some environments (e.g. Expo Go).
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          const screen = response?.notification.request.content.data?.screen;
          if (screen === 'active-workout') {
            router.push('/active-workout');
          }
        })
        .catch(() => {
          // Native module not linked or unavailable; skip cold-start handling.
        });
    }

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'active-workout') {
        router.push('/active-workout');
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  return null;
}
