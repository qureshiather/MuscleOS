import 'react-native-gesture-handler';
import { useEffect, useState, lazy, Suspense } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { LinkPreviewContextProvider } from 'expo-router/build/link/preview/LinkPreviewContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, brandColors } from '@/theme/ThemeContext';
import { useAppFonts } from '@/theme/useAppFonts';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { syncNow } from '@/sync';
import { useSyncStore } from '@/store/syncStore';

// expo-notifications is not supported in Expo Go (SDK 53+). Load only in dev builds / production.
const WorkoutNotificationHandler = lazy(() =>
  import('@/components/WorkoutNotificationHandler')
);

const isExpoGo = Constants.appOwnership === 'expo';

// Defer mounting so native module registry is ready (avoids Android crash: "Cannot create event emitter for module not in registry").
const NOTIFICATION_HANDLER_DELAY_MS = 800;

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
  const { loaded: fontsLoaded } = useAppFonts();
  const [mountNotifications, setMountNotifications] = useState(false);
  const initAuth = useAuthStore((s) => s.init);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadCustomExercises = useExercisesStore((s) => s.load);
  const loadExerciseNotes = useExerciseNotesStore((s) => s.load);

  useEffect(() => {
    (async () => {
      try {
        const userId = await initAuth();
        await loadSubscription(userId);
        loadSettings();
        loadCustomExercises();
        loadExerciseNotes();
        void useSyncStore.getState().loadStatus();
        void syncNow();
      } catch (e) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('App init error:', e);
        }
      }
    })();
  }, [initAuth, loadSubscription, loadSettings, loadCustomExercises, loadExerciseNotes]);

  useEffect(() => {
    if (isExpoGo) return;
    const t = setTimeout(() => setMountNotifications(true), NOTIFICATION_HANDLER_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const userId = useAuthStore.getState().user?.id;
        void loadSubscription(userId);
        void syncNow();
      }
    });
    return () => sub.remove();
  }, [loadSubscription]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: brandColors.background }}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {!isExpoGo && mountNotifications && (
          <Suspense fallback={null}>
            <WorkoutNotificationHandler />
          </Suspense>
        )}
        <ThemedStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
