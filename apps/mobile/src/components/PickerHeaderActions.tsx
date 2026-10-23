import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/tokens';

/**
 * Top-right of an exercise picker sheet: **+ New** (create a custom exercise, when `onNew` is given)
 * beside **Done**.
 * Spec: docs/features/exercise-library.md#exercise-pickers
 */
export function PickerHeaderActions({ onNew, onDone }: { onNew?: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {onNew ? (
        <Pressable
          onPress={onNew}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="New custom exercise"
          testID="picker-new-exercise"
          style={({ pressed }) => [
            styles.newBtn,
            { borderColor: colors.primaryBorder, backgroundColor: colors.primarySurface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={[styles.newText, { color: colors.primary }]}>New</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onDone} hitSlop={8} accessibilityRole="button" testID="picker-done">
        <Text style={[styles.done, { color: colors.primary }]}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  newText: { fontSize: 15, fontWeight: '600' },
  done: { fontSize: 16, fontWeight: '600' },
});
