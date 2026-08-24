import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

type StatChipProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function StatChip({ icon, label }: StatChipProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}>
      <Ionicons name={icon} size={12} color={colors.textSecondary} />
      <Text style={[typography.caption, styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  label: {
    fontFamily: typography.data.fontFamily,
  },
});
