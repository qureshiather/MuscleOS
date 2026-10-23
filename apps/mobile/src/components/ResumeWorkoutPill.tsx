import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeContext';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { Ionicons } from '@expo/vector-icons';
import { formatClockMs } from '@/utils/formatClock';
import { isEditingFinishedSession } from '@/store/activeWorkoutLogic';
import { activeSessionCopy } from '@/utils/activeSessionCopy';

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
  const editing = isEditingFinishedSession(session);
  const copy = activeSessionCopy(session);

  function handleResume() {
    router.push('/active-workout');
  }

  function handleCancel() {
    // Call store directly so cancel always clears session (e.g. from pill X or after alert)
    useActiveWorkoutStore.getState().discardWorkout();
  }

  return (
    <View
      testID="resume-workout-pill"
      style={[styles.pill, { backgroundColor: colors.primarySurface, borderTopColor: colors.border }]}
    >
      <Pressable style={styles.main} onPress={handleResume} accessibilityRole="button" accessibilityLabel={copy.resumeLabel}>
        <View style={[styles.iconDot, { backgroundColor: colors.primary }]}>
          <Ionicons name={editing ? 'create' : 'barbell'} size={14} color={colors.primaryOn} />
        </View>
        <Text style={[typography.bodyMedium, styles.label, { color: colors.text }]}>{copy.resumeLabel}</Text>
        {/* An edit isn't timed: the workout's duration stays what it was. */}
        {editing ? null : (
          <Text style={[typography.data, styles.time, { color: colors.primary }]}>{formatClockMs(elapsedMs)}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={handleCancel}
        hitSlop={12}
        style={styles.cancelBtn}
        accessibilityRole="button"
        // Discards straight away (no confirm), so say so rather than "Cancel".
        accessibilityLabel={editing ? 'Discard changes' : 'Discard workout'}
      >
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
    borderTopWidth: 1,
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
