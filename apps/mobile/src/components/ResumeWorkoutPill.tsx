import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeContext';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { Ionicons } from '@expo/vector-icons';

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ResumeWorkoutPill() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useActiveWorkoutStore((s) => s.session);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsedMs(Date.now() - start);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session?.startedAt]);

  if (!session) return null;

  function handleResume() {
    router.push('/active-workout');
  }

  function handleCancel() {
    // Call store directly so cancel always clears session (e.g. from pill X or after alert)
    useActiveWorkoutStore.getState().discardWorkout();
  }

  return (
    <View style={[styles.pill, { backgroundColor: colors.primary + '18', borderBottomColor: colors.border }]}>
      <Pressable style={styles.main} onPress={handleResume}>
        <View style={[styles.iconDot, { backgroundColor: colors.primary }]}>
          <Ionicons name="barbell" size={14} color="#FFFFFF" />
        </View>
        <Text style={[typography.bodyMedium, styles.label, { color: colors.text }]}>Resume workout</Text>
        <Text style={[typography.data, styles.time, { color: colors.primary }]}>{formatElapsed(elapsedMs)}</Text>
      </Pressable>
      <Pressable onPress={handleCancel} hitSlop={12} style={styles.cancelBtn}>
        <Ionicons name="close" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, flex: 1 },
  iconDot: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  time: {},
  cancelBtn: { padding: spacing.xs },
});
