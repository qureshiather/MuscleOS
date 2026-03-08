import { useEffect, lazy, Suspense } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { LinkPreviewContextProvider } from 'expo-router/build/link/preview/LinkPreviewContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useExercisesStore } from '@/store/exercisesStore';

// expo-notifications is not supported in Expo Go (SDK 53+). Load only in dev builds / production.
const WorkoutNotificationHandler = lazy(() =>
  import('@/components/WorkoutNotificationHandler')
);

const isExpoGo = Constants.appOwnership === 'expo';

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinkPreviewContextProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen
              name="active-workout"
              options={{
                animation: 'slide_from_bottom',
                gestureDirection: 'vertical',
              }}
            />
          </Stack>
        </LinkPreviewContextProvider>
      </View>
    </>
  );
}

export default function RootLayout() {
  const initAuth = useAuthStore((s) => s.init);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadCustomExercises = useExercisesStore((s) => s.load);
  useEffect(() => {
    (async () => {
      try {
        const userId = await initAuth();
        await loadSubscription(userId);
        loadSettings();
        loadCustomExercises();
      } catch (e) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('App init error:', e);
        }
      }
    })();
  }, [initAuth, loadSubscription, loadSettings, loadCustomExercises]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {!isExpoGo && (
          <Suspense fallback={null}>
            <WorkoutNotificationHandler />
          </Suspense>
        )}
        <ThemedStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
