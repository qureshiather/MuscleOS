import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
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
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.header}>
        <Text style={[styles.weightLabel, { color: colors.textSecondary }]}>
          {formatWeight(totalKg, unit)}
        </Text>
        <Text style={[styles.barLabel, { color: colors.textMuted }]}>
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
            <Text style={[styles.barText, { color: colors.textMuted }]}>bar</Text>
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
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Enter weight above bar ({BAR_WEIGHT_KG} kg)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  weightLabel: { fontSize: 18, fontWeight: '700' },
  barLabel: { fontSize: 13 },
  platesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  plateGroup: { flexDirection: 'row', gap: 2 },
  plate: {
    width: 28,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bar: {
    width: 48,
    height: 12,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  barText: { fontSize: 10 },
  hint: { fontSize: 14 },
});
