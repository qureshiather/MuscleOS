import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { MuscleId } from '@muscleos/types';
import { BodyFigure, FIGURE_BASE_WIDTH } from '@/components/BodyFigure';
import type { MuscleRegion } from '@/data/bodyFigures';
import { useTheme, getRecoveryPalette, type ThemeColors } from '@/theme/ThemeContext';
import { useDeviceMetrics } from '@/theme/layout';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import {
  MUSCLE_ID_TO_DIAGRAM_REGION,
  musclesOnView,
  regionStatesByView,
  regionStatesToBodyData,
  type BodyDataItem,
  type DiagramView,
} from '@/utils/muscleDiagramRegions';

/** Tight enough that both views stay on one row on SE / Display Zoom. */
const PAIR_GAP = 8;
const PAIR_BASE_WIDTH = FIGURE_BASE_WIDTH * 2 + PAIR_GAP;

function scaleToFit(availableWidth: number, size: number): number {
  if (availableWidth <= 0) return size;
  return Math.min(size, availableWidth / PAIR_BASE_WIDTH);
}


const ALL_MUSCLE_IDS = Object.keys(MUSCLE_ID_TO_DIAGRAM_REGION) as MuscleId[];

export type DiagramVariant = 'male' | 'female';

function getHighlightGradient(colors: ThemeColors, mode: 'green' | 'orange'): [string, string] {
  if (mode === 'green') {
    return [colors.recoveryReady, colors.muscleHighlight];
  }
  return [colors.primary, colors.primaryDim];
}

/**
 * Front and back body figures. Three modes:
 * - **Highlight** (default): `muscleIds` in the highlight gradient, the rest neutral.
 * - **Recovery** (`recoveringMuscleIds`): every region coloured just trained / recovering / ready.
 * - **Session** (`sessionMuscleIds`): the post-workout view — those muscles in the just-trained
 *   colour and the rest of the body in the neutral untrained fill (not Ready).
 */
export function MuscleDiagram({
  muscleIds = [],
  size = 1,
  variant,
  highlightColor,
  recoveringMuscleIds,
  justTrainedMuscleIds,
  sessionMuscleIds,
}: {
  muscleIds?: MuscleId[];
  size?: number;
  variant?: DiagramVariant;
  highlightColor?: 'green' | 'orange';
  recoveringMuscleIds?: MuscleId[];
  justTrainedMuscleIds?: MuscleId[];
  sessionMuscleIds?: MuscleId[];
}) {
  const { colors } = useTheme();
  const { width } = useDeviceMetrics();
  const [rowWidth, setRowWidth] = useState(0);
  const profile = useSettingsStore((s) => s.profile);
  const userGender = profile?.sex === 'female' ? 'female' : 'male';
  const gender = (variant ?? userGender) as 'male' | 'female';

  const isSessionMode = sessionMuscleIds != null;
  const isRecoveryMode = !isSessionMode && recoveringMuscleIds != null;

  // Per view: the figure draws `deltoids` on both, but front and rear delts belong to one side.
  function dataFor(view: DiagramView): BodyDataItem[] {
    if (isSessionMode) {
      const trained = new Set(sessionMuscleIds);
      return regionStatesToBodyData(regionStatesByView(sessionMuscleIds, trained, trained)[view]);
    }
    if (isRecoveryMode) {
      const states = regionStatesByView(
        ALL_MUSCLE_IDS,
        new Set(recoveringMuscleIds),
        new Set(justTrainedMuscleIds)
      )[view];
      return regionStatesToBodyData(states);
    }
    const slugSet = new Set<MuscleRegion>(musclesOnView(muscleIds, view).map((id) => MUSCLE_ID_TO_DIAGRAM_REGION[id]));
    return Array.from(slugSet).map((slug) => ({ slug, intensity: 1 }));
  }

  const frontData = dataFor('front');
  const backData = dataFor('back');

  const useGreen = highlightColor === 'green';
  // Each figure is 200pt wide at scale 1. Size the pair from the real row
  // width so front + back never wrap — including inside padded cards.
  const fallbackWidth = width - spacing.lg * 4;
  const resolvedScale = scaleToFit(rowWidth > 0 ? rowWidth : fallbackWidth, size);
  const colorPalette = isRecoveryMode || isSessionMode
    ? getRecoveryPalette(colors)
    : getHighlightGradient(colors, useGreen ? 'green' : 'orange');

  return (
    <View
      style={styles.wrapper}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setRowWidth((prev) => (prev === next ? prev : next));
      }}
    >
      <View style={styles.row}>
        <BodyFigure data={frontData} gender={gender} side="front" scale={resolvedScale} colors={colorPalette} />
        <BodyFigure data={backData} gender={gender} side="back" scale={resolvedScale} colors={colorPalette} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: PAIR_GAP,
    width: '100%',
  },
});
