import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { LinkPreviewContextProvider } from 'expo-router/build/link/preview/LinkPreviewContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useSettingsStore } from '@/store/settingsStore';

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinkPreviewContextProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        />
      </LinkPreviewContextProvider>
    </>
  );
}

export default function RootLayout() {
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  useEffect(() => {
    loadProfile();
    loadSubscription();
    loadSettings();
  }, [loadProfile, loadSubscription, loadSettings]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
