import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSession } from '@muscleos/types';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeContext';
import { withAlpha } from '@/theme/palette';
import { typography } from '@/theme/typography';
import { spacing, touch } from '@/theme/tokens';
import { formatSessionDuration, formatSetGroups, formatVolume, sessionVolumeKg } from '@/utils/sessionStats';
import type { WeightUnit } from '@/utils/weightUnits';

function formatSessionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

type SessionCardProps = {
  session: WorkoutSession;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onMore: () => void;
  /** Exercises that set a new best e1RM in this session. Omitted for Basic. */
  prExerciseIds?: ReadonlySet<string>;
  /** Whole-percent volume change vs the previous session of the same template. */
  volumeDelta?: number;
  getExerciseName: (exerciseId: string) => string;
  weightUnit: WeightUnit;
};

/** History list card: a one-glance summary that expands to one line per exercise. */
export function SessionCard({
  session,
  title,
  expanded,
  onToggle,
  onMore,
  prExerciseIds,
  volumeDelta,
  getExerciseName,
  weightUnit,
}: SessionCardProps) {
  const { colors } = useTheme();
  const exercises = session.exercises
    .map((se) => ({ exerciseId: se.exerciseId, sets: se.sets.filter((set) => set.completed) }))
    .filter((se) => se.sets.length > 0);
  const setCount = exercises.reduce((n, se) => n + se.sets.length, 0);
  const prCount = exercises.filter((se) => prExerciseIds?.has(se.exerciseId)).length;
  const duration = formatSessionDuration(session);
  const volume = sessionVolumeKg(session);
  const stats = [duration, volume > 0 ? formatVolume(volume, weightUnit) : null].filter(Boolean).join(' · ');
  const showDelta = volumeDelta != null && volumeDelta !== 0;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Hides the exercises' : 'Shows the exercises'}
        onPress={onToggle}
        style={styles.pressable}
      >
        <View style={styles.row}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {session.completedAt ? formatSessionDate(session.completedAt) : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Options for ${title}`}
            onPress={onMore}
            hitSlop={touch.hitSlop}
            style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={[typography.bodyMedium, styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {stats ? (
            <Text style={[styles.stats, { color: colors.textSecondary }]}>
              {stats}
              {showDelta ? (
                <Text style={{ color: volumeDelta > 0 ? colors.success : colors.danger }}>
                  {` ${volumeDelta > 0 ? '↑' : '↓'}${Math.abs(volumeDelta)}%`}
                </Text>
              ) : null}
            </Text>
          ) : null}
        </View>

        <View style={styles.row}>
          <Text style={[typography.caption, styles.peek, { color: colors.textMuted }]} numberOfLines={1}>
            {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {setCount}{' '}
            {setCount === 1 ? 'set' : 'sets'}
            {prCount > 0 ? (
              <Text style={{ color: colors.warning }}>{` · ${prCount} ${prCount === 1 ? 'PR' : 'PRs'}`}</Text>
            ) : null}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textMuted}
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </View>

        {expanded && exercises.length > 0 ? (
          <View style={[styles.detail, { borderTopColor: colors.border }]}>
            {exercises.map((se, idx) => {
              const isPR = prExerciseIds?.has(se.exerciseId) ?? false;
              return (
                <View
                  key={`${se.exerciseId}-${idx}`}
                  style={[
                    styles.exerciseRow,
                    idx < exercises.length - 1 && [styles.exerciseRowDivider, { borderBottomColor: colors.border }],
                  ]}
                >
                  <View style={styles.exerciseName}>
                    <Text style={[typography.label, styles.exerciseNameText, { color: colors.text }]}>
                      {getExerciseName(se.exerciseId)}
                    </Text>
                    {isPR ? (
                      <View style={[styles.prBadge, { backgroundColor: withAlpha(colors.warning, 0.14) }]}>
                        <Ionicons name="trophy" size={10} color={colors.warning} />
                        <Text style={[styles.prText, { color: colors.warning }]}>PR</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.sets, { color: colors.textSecondary }]}>
                    {formatSetGroups(se.sets, weightUnit)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0 },
  pressable: { padding: spacing.md, gap: spacing.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  moreBtn: { padding: 2 },
  pressed: { opacity: 0.6 },
  title: { flexShrink: 1 },
  stats: { ...typography.caption, fontFamily: typography.data.fontFamily, fontVariant: ['tabular-nums'] },
  peek: { flex: 1 },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.xs, paddingTop: spacing.xs },
  exerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: 2,
    paddingVertical: spacing.sm - 1,
  },
  exerciseRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  exerciseName: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  exerciseNameText: { flexShrink: 1 },
  prBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  prText: { fontFamily: typography.data.fontFamily, fontSize: 10, lineHeight: 14 },
  sets: {
    ...typography.caption,
    fontFamily: typography.data.fontFamily,
    fontVariant: ['tabular-nums'],
    marginLeft: 'auto',
    textAlign: 'right',
  },
});
