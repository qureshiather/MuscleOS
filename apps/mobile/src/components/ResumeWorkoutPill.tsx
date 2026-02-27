import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
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
  const discardWorkout = useActiveWorkoutStore((s) => s.discardWorkout);
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
    discardWorkout();
  }

  return (
    <View style={[styles.pill, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
      <Pressable style={styles.main} onPress={handleResume}>
        <Ionicons name="barbell" size={18} color={colors.primary} />
        <Text style={[styles.label, { color: colors.text }]}>Resume workout</Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{formatElapsed(elapsedMs)}</Text>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  label: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 14 },
  cancelBtn: { padding: 4 },
});
