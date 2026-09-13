import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { touch } from '@/theme/tokens';
import type { WorkoutTemplate } from '@muscleos/types';

type TemplateCardProps = {
  template: WorkoutTemplate;
  lastDone?: string | null;
  onPress: (template: WorkoutTemplate) => void;
  onMenu?: (template: WorkoutTemplate) => void;
  /** Custom template on a Basic account: visible, but starting it requires Pro. */
  locked?: boolean;
};

export function TemplateCard({
  template,
  lastDone,
  onPress,
  onMenu,
  locked,
}: TemplateCardProps) {
  const { colors, isDark } = useTheme();
  const description = template.description?.trim();
  const exerciseCount = template.exerciseIds.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${template.name}, ${exerciseCount} exercises, requires Pro`
          : `${template.name}, ${exerciseCount} exercises`
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surfaceElevated },
        !isDark && { borderWidth: 1, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(template)}
    >
      <View style={styles.titleRow}>
        <Text
          style={[
            styles.name,
            { color: colors.text },
            !description && styles.nameNoDesc,
          ]}
          numberOfLines={2}
        >
          {template.name}
        </Text>
        {locked ? <Ionicons name="lock-closed" size={13} color={colors.textMuted} /> : null}
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
        <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
      {lastDone ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>Last done: {lastDone}</Text>
      ) : null}
      <Text style={[styles.count, { color: colors.textMuted }]}>
        {exerciseCount} exercises
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 2,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { ...typography.bodyMedium, flex: 1, minWidth: 0, marginBottom: 2 },
  nameNoDesc: { marginBottom: 6 },
  menuBtn: { padding: 4 },
  desc: { fontSize: typography.caption.fontSize, marginBottom: 6 },
  meta: { fontSize: 11, marginTop: 2 },
  count: { fontSize: 11, marginTop: 4 },
  pressed: { opacity: 0.85 },
});
