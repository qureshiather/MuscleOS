import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import type { WorkoutTemplate } from '@muscleos/types';
import type { TemplateCardModel } from '@/utils/templateCard';

type TemplateCardProps = {
  template: WorkoutTemplate;
  model: TemplateCardModel;
  lastDone?: string | null;
  onPress: (template: WorkoutTemplate) => void;
  onMenu?: (template: WorkoutTemplate) => void;
};

/**
 * A workout on the Workouts tab, styled like a History card: name and size, the exercise lineup,
 * its main muscles as pills, and when it was last done (docs/features/templates.md#template-cards).
 */
export function TemplateCard({ template, model, lastDone, onPress, onMenu }: TemplateCardProps) {
  const { colors, isDark } = useTheme();
  const description = template.description?.trim();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.name}, ${model.exerciseNames.length} exercises`}
      testID={`template-card-${template.id}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: isDark ? colors.surfaceElevated : colors.surface, borderColor: colors.border },
        !isDark && [styles.cardLight, { shadowColor: colors.shadow }],
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(template)}
    >
      <View style={styles.row}>
        <Text style={[typography.bodyMedium, styles.name, { color: colors.text }]} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{model.meta}</Text>
        {onMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Options for ${template.name}`}
            hitSlop={touch.hitSlop}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
            onPress={() => onMenu(template)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {description ? (
        <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      {model.exerciseNames.length > 0 ? (
        <Text style={[typography.label, styles.lineup, { color: colors.text }]} numberOfLines={2}>
          {model.exerciseNames.join('  ·  ')}
        </Text>
      ) : null}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.pills}>
          {model.muscles.map((m) => (
            <View key={m.id} style={[styles.pill, { backgroundColor: colors.primarySurface }]}>
              <Text style={[styles.pillText, { color: colors.primary }]}>{m.label}</Text>
            </View>
          ))}
        </View>
        {lastDone ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>Last done: {lastDone}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: 2,
  },
  cardLight: Platform.select({
    ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
    android: { elevation: 1 },
    default: {},
  }),
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, minWidth: 0 },
  meta: { ...typography.caption, fontFamily: typography.data.fontFamily, fontVariant: ['tabular-nums'] },
  menuBtn: { padding: 2 },
  lineup: { lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  pills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  pillText: { ...typography.caption, fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
