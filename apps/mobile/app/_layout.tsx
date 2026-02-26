import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@/theme/ThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export default function RootLayout() {
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const loadSubscription = useSubscriptionStore((s) => s.load);
  useEffect(() => {
    loadProfile();
    loadSubscription();
  }, [loadProfile, loadSubscription]);

  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0b' },
          animation: 'slide_from_right',
        }}
      />
    </ThemeProvider>
  );
}
