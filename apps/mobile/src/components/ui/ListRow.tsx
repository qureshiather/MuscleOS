import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

type ListRowProps = {
  title: string;
  hint?: string;
  onPress: () => void;
};

export function ListRow({ title, hint, onPress }: ListRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.textBlock}>
        <Text style={[typography.bodyMedium, { color: colors.text }]}>{title}</Text>
        {hint ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{hint}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  textBlock: { flex: 1, minWidth: 0, marginRight: spacing.sm },
});
