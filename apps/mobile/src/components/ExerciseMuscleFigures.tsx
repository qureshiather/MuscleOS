import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MuscleId } from '@muscleos/types';
import { BodyFigure, FIGURE_BASE_WIDTH } from '@/components/BodyFigure';
import { useSettingsStore } from '@/store/settingsStore';
import { blendOver } from '@/theme/palette';
import { useTheme } from '@/theme/ThemeContext';
import { mainAndAlsoBodyData } from '@/utils/muscleDiagramRegions';

/** Strength of the "also works" tint over the neutral body fill. */
const ALSO_ALPHA = 0.45;

/**
 * One exercise's muscles on a front and back figure: the main (first-listed) muscle in the
 * highlight colour, the others it works in a weaker tint — or, with `even`, every muscle in the
 * highlight colour (a whole template). `width` is each figure's width.
 * Spec: docs/features/exercise-library.md#exercise-pickers
 */
export const ExerciseMuscleFigures = memo(function ExerciseMuscleFigures({
  muscles,
  width,
  gap = 2,
  even = false,
}: {
  muscles: readonly MuscleId[];
  width: number;
  gap?: number;
  even?: boolean;
}) {
  const { colors } = useTheme();
  const sex = useSettingsStore((s) => s.profile?.sex);
  const gender = sex === 'female' ? 'female' : 'male';
  const palette = [colors.muscleHighlight, blendOver(colors.muscleHighlight, ALSO_ALPHA, colors.bodyDiagramFill)];
  const scale = width / FIGURE_BASE_WIDTH;
  const data = (view: 'front' | 'back') =>
    even ? mainAndAlsoBodyData(muscles, view).map((d) => ({ ...d, intensity: 1 })) : mainAndAlsoBodyData(muscles, view);
  return (
    <View style={[styles.row, { gap }]}>
      <BodyFigure gender={gender} side="front" scale={scale} data={data('front')} colors={palette} />
      <BodyFigure gender={gender} side="back" scale={scale} data={data('back')} colors={palette} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
