import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { withAlpha } from '@/theme/palette';
import { muscleDistribution, regionColor } from '@/utils/trainingRegion';
import type { MuscleId } from '@muscleos/types';

/**
 * Weight falls off by rank, so a chest-focused day reads as one hue stepping down
 * rather than as four unrelated colors.
 */
const RANK_ALPHA = [1, 0.68, 0.46, 0.3];

type MuscleLoadBarProps = {
  muscleIds: readonly MuscleId[];
  height?: number;
  /** Locked templates keep the shape but drop the color. */
  muted?: boolean;
};

/**
 * Proportional split of a template's work across its top muscles. Segment widths are
 * real data, which is why this replaces a decorative accent bar.
 */
export function MuscleLoadBar({ muscleIds, height = 3, muted }: MuscleLoadBarProps) {
  const { colors } = useTheme();
  const segments = muscleDistribution(muscleIds);

  if (segments.length === 0) return null;

  return (
    <View
      style={[styles.track, { height, backgroundColor: colors.surfaceElevated }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {segments.map((segment, index) => (
        <View
          key={segment.id}
          style={{
            flexGrow: segment.share,
            flexBasis: 0,
            backgroundColor: withAlpha(
              muted ? colors.textMuted : regionColor(segment.region, colors),
              RANK_ALPHA[index] ?? 0.25
            ),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
});
