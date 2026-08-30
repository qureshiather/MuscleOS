import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { getPlatesForWeight, BAR_WEIGHT_KG } from '@/utils/plateCalculator';
import { formatWeight } from '@/utils/weightUnits';
import type { WeightUnit } from '@/utils/weightUnits';

export interface PlateCalculatorProps {
  totalKg: number;
  unit?: WeightUnit;
}

export function PlateCalculator({ totalKg, unit = 'kg' }: PlateCalculatorProps) {
  const { colors } = useTheme();
  const load = totalKg > BAR_WEIGHT_KG ? getPlatesForWeight(totalKg) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[typography.dataLarge, styles.weightLabel, { color: colors.text }]}>
          {formatWeight(totalKg, unit)}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {BAR_WEIGHT_KG} kg bar
        </Text>
      </View>
      {load ? (
        <View style={styles.platesRow}>
          <View style={styles.side}>
            {load.platesPerSide.map(({ kg, count }) => (
              <View key={kg} style={styles.plateGroup}>
                {Array.from({ length: count }).map((_, i) => (
                  <View
                    key={`${kg}-${i}`}
                    style={[styles.plate, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.plateText}>{kg}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={[styles.bar, { backgroundColor: colors.border }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>bar</Text>
          </View>
          <View style={styles.side}>
            {load.platesPerSide.map(({ kg, count }) => (
              <View key={kg} style={styles.plateGroup}>
                {Array.from({ length: count }).map((_, i) => (
                  <View
                    key={`${kg}-${i}`}
                    style={[styles.plate, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.plateText}>{kg}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Enter weight above bar ({BAR_WEIGHT_KG} kg)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  weightLabel: { fontSize: 18 },
  platesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  plateGroup: { flexDirection: 'row', gap: 2 },
  plate: {
    width: 28,
    height: 48,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: { color: '#fff', fontSize: 10, fontFamily: typography.data.fontFamily },
  bar: {
    width: 36,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
