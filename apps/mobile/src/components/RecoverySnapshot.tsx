import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { useRecoveryStore } from '@/store/recoveryStore';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

const MAX_LABELS = 3;

export function RecoverySnapshot() {
  const { colors } = useTheme();
  const router = useRouter();
  const load = useRecoveryStore((s) => s.load);
  const activeRecovery = useRecoveryStore((s) => s.activeRecovery);
  const isLoading = useRecoveryStore((s) => s.isLoading);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const active = activeRecovery();
  const uniqueMuscleIds = [...new Set(active.map((r) => r.muscleId))];
  const count = uniqueMuscleIds.length;

  if (isLoading) return null;

  const labels = uniqueMuscleIds.slice(0, MAX_LABELS).map((id) => MUSCLE_GROUPS[id as MuscleId].name);
  const overflow = count > MAX_LABELS ? count - MAX_LABELS : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
      onPress={() => router.push('/(tabs)/recovery')}
    >
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons
            name={count === 0 ? 'checkmark-circle' : 'pulse'}
            size={20}
            color={count === 0 ? colors.recoveryReady : colors.recoveryWarm}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            {count === 0 ? 'All clear' : `${count} muscle${count === 1 ? '' : 's'} recovering`}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {count === 0
              ? 'Every muscle group is ready to train'
              : overflow > 0
                ? `${labels.join(', ')} +${overflow} more`
                : labels.join(', ')}
          </Text>
        </View>
      </View>
      <View style={styles.dots}>
        {count === 0 ? (
          <View style={[styles.dot, { backgroundColor: colors.recoveryReady }]} />
        ) : (
          <>
            <View style={[styles.dot, { backgroundColor: colors.recoveryHot }]} />
            <View style={[styles.dot, { backgroundColor: colors.recoveryWarm }]} />
            <View style={[styles.dot, { backgroundColor: colors.recoveryReady }]} />
          </>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, minWidth: 0 },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
