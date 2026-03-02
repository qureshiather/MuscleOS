import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, Redirect, usePathname, useGlobalSearchParams } from 'expo-router';
import { LinkPreviewContextProvider } from 'expo-router/build/link/preview/LinkPreviewContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';

/** When we're on /active-workout with no session and no params to start one, redirect to main app. Renders alongside Stack so navigator is mounted first. */
function ActiveWorkoutRedirectGate() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ templateId?: string; dayId?: string; dayName?: string }>();
  const session = useActiveWorkoutStore((s) => s.session);
  const shouldRedirect =
    pathname === '/active-workout' &&
    !session &&
    !(params.templateId && params.dayId && params.dayName);
  if (shouldRedirect) return <Redirect href="/(tabs)" />;
  return null;
}

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
              // Keep previous screen mounted so back transition reveals it instead of a white flash
              detachInactiveScreens: false,
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
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadCustomExercises = useExercisesStore((s) => s.load);
  useEffect(() => {
    loadProfile();
    loadSubscription();
    loadSettings();
    loadCustomExercises();
  }, [loadProfile, loadSubscription, loadSettings, loadCustomExercises]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStack />
        <ActiveWorkoutRedirectGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
