import { ScrollView, View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import type { WorkoutTemplate, WorkoutSession } from '@muscleos/types';

type RecentWorkoutsRowProps = {
  items: { session: WorkoutSession; template: WorkoutTemplate }[];
  onPress: (template: WorkoutTemplate) => void;
  formatRelative: (iso: string) => string;
};

export function RecentWorkoutsRow({ items, onPress, formatRelative }: RecentWorkoutsRowProps) {
  const { colors, isDark } = useTheme();

  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {items.map(({ session, template }) => {
        const completedAgo = session.completedAt ? formatRelative(session.completedAt) : null;
        return (
          <Pressable
            key={session.id}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
              !isDark && styles.cardLight,
            ]}
            onPress={() => onPress(template)}
          >
            <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={2}>
              {template.name}
            </Text>
            {completedAgo ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {completedAgo}
              </Text>
            ) : null}
            <Text style={[typography.caption, styles.meta, { color: colors.textMuted }]}>
              {template.exerciseIds.length} exercises
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type QuickStartGridProps = {
  templates: WorkoutTemplate[];
  onPress: (template: WorkoutTemplate) => void;
  cardStyle?: StyleProp<ViewStyle>;
};

export function QuickStartGrid({ templates, onPress }: QuickStartGridProps) {
  const { colors, isDark } = useTheme();

  if (templates.length === 0) return null;

  return (
    <View style={styles.grid}>
      {templates.map((template) => (
        <Pressable
          key={template.id}
          style={({ pressed }) => [
            styles.gridCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              opacity: pressed ? 0.9 : 1,
            },
            !isDark && styles.cardLight,
          ]}
          onPress={() => onPress(template)}
        >
          <Ionicons name="barbell-outline" size={18} color={colors.primary} />
          <Text style={[typography.bodyMedium, styles.gridTitle, { color: colors.text }]} numberOfLines={2}>
            {template.name}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {template.exerciseIds.length} exercises
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  card: {
    width: 160,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  meta: { marginTop: spacing.xs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCard: {
    width: '47%',
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  gridTitle: { marginTop: spacing.xs / 2 },
});
