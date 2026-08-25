import { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs, useRouter, useLocalSearchParams } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { ResumeWorkoutPill } from '@/components/ResumeWorkoutPill';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';

function TabBarWithResumePill({
  showPill,
  ...props
}: BottomTabBarProps & { showPill: boolean }) {
  return (
    <View>
      {showPill ? <ResumeWorkoutPill /> : null}
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
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
    <Tabs
      tabBar={(props) => <TabBarWithResumePill {...props} showPill={showPill} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: spacing.xs,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { ...typography.caption, fontFamily: typography.label.fontFamily },
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
