import { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { ResumeWorkoutPill } from '@/components/ResumeWorkoutPill';

/** Content height of the tab bar (without safe area). Matches default tab bar so pill sits flush. */
const TAB_BAR_CONTENT_HEIGHT = 49;

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarBottomOffset = TAB_BAR_CONTENT_HEIGHT + insets.bottom;
  const session = useActiveWorkoutStore((s) => s.session);
  const router = useRouter();
  const params = useLocalSearchParams<{ discardWorkout?: string }>();

  // When we land on tabs with ?discardWorkout=1 (after cancel in active-workout), clear session here so pill never shows
  useEffect(() => {
    if (params.discardWorkout === '1') {
      useActiveWorkoutStore.getState().discardWorkout();
      router.replace('/(tabs)');
    }
  }, [params.discardWorkout, router]);

  const showPill = session != null && params.discardWorkout !== '1';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recovery"
        options={{
          title: 'Recovery',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      </Tabs>
      <View style={{ position: 'absolute', bottom: tabBarBottomOffset, left: 0, right: 0 }}>
        {showPill && <ResumeWorkoutPill />}
      </View>
    </View>
  );
}
