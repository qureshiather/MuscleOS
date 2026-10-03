import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSession } from '@muscleos/types';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeContext';
import { withAlpha } from '@/theme/palette';
import { typography } from '@/theme/typography';
import { spacing, touch } from '@/theme/tokens';
import { formatSetGroups } from '@/utils/sessionStats';
import { sessionCardSummary, volumeDeltaLabel } from '@/utils/historyCards';
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
  onDelete: () => void;
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
  onDelete,
  prExerciseIds,
  volumeDelta,
  getExerciseName,
  weightUnit,
}: SessionCardProps) {
  const { colors } = useTheme();
  const { exercises, countsLine, prLabel, statsLine: stats } = sessionCardSummary(
    session,
    prExerciseIds,
    weightUnit
  );
  const delta = volumeDeltaLabel(volumeDelta);

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
            accessibilityLabel={`Delete ${title}`}
            onPress={onDelete}
            hitSlop={touch.hitSlop}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={[typography.bodyMedium, styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {stats ? (
            <Text style={[styles.stats, { color: colors.textSecondary }]}>
              {stats}
              {delta ? (
                <Text style={{ color: delta.up ? colors.success : colors.danger }}>{` ${delta.text}`}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>

        <View style={styles.row}>
          <Text style={[typography.caption, styles.peek, { color: colors.textMuted }]} numberOfLines={1}>
            {countsLine}
            {prLabel ? <Text style={{ color: colors.warning }}>{` · ${prLabel}`}</Text> : null}
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
  deleteBtn: { padding: 2 },
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
