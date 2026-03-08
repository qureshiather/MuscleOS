import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useWorkoutNotification } from '@/hooks/useWorkoutNotification';

export default function WorkoutNotificationHandler() {
  const router = useRouter();
  useWorkoutNotification();

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // On iOS: no banner/alert so it only appears in the notification center (tray), like Android
        shouldShowAlert: Platform.OS !== 'ios',
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: Platform.OS !== 'ios',
        shouldShowList: true,
      }),
    });
  }, []);

  useEffect(() => {
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

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'active-workout') {
        router.push('/active-workout');
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
