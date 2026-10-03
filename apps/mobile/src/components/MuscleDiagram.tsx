import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { Slug } from 'react-native-body-highlighter';
import type { MuscleId } from '@muscleos/types';
import { useTheme, getRecoveryPalette, type ThemeColors } from '@/theme/ThemeContext';
import { useDeviceMetrics } from '@/theme/layout';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import {
  MUSCLE_ID_TO_DIAGRAM_REGION,
  regionStatesForMuscles,
  regionStatesToBodyData,
} from '@/utils/muscleDiagramRegions';

/** Library figure size at `scale={1}`. */
const FIGURE_BASE_WIDTH = 200;
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
 * - **Highlight** (default): `muscleIds` in the highlight colour, the rest neutral.
 * - **Recovery** (`recoveringMuscleIds`): every region coloured recovering / ready, plus just
 *   trained when `justTrainedMuscleIds` is non-empty (three-state palette).
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
  const useThreeStates = isSessionMode || (isRecoveryMode && (justTrainedMuscleIds?.length ?? 0) > 0);

  let data: { slug: Slug; intensity: number }[];
  if (isSessionMode) {
    const trained = new Set(sessionMuscleIds);
    data = regionStatesToBodyData(regionStatesForMuscles(sessionMuscleIds, trained, trained), true);
  } else if (isRecoveryMode) {
    const states = regionStatesForMuscles(
      ALL_MUSCLE_IDS,
      new Set(recoveringMuscleIds),
      new Set(useThreeStates ? justTrainedMuscleIds : [])
    );
    data = regionStatesToBodyData(states, useThreeStates);
  } else {
    const slugSet = new Set<Slug>(muscleIds.map((id) => MUSCLE_ID_TO_DIAGRAM_REGION[id]));
    data = Array.from(slugSet).map((slug) => ({ slug, intensity: 1 }));
  }

  const useGreen = highlightColor === 'green';
  // Each figure is 200pt wide at scale 1. Size the pair from the real row
  // width so front + back never wrap — including inside padded cards.
  const fallbackWidth = width - spacing.lg * 4;
  const resolvedScale = scaleToFit(rowWidth > 0 ? rowWidth : fallbackWidth, size);
  const colorPalette = isRecoveryMode || isSessionMode
    ? getRecoveryPalette(colors, useThreeStates)
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
        <Body
          data={data}
          gender={gender}
          side="front"
          scale={resolvedScale}
          colors={colorPalette}
          border={colors.bodyDiagramBorder}
          defaultFill={colors.bodyDiagramFill}
        />
        <Body
          data={data}
          gender={gender}
          side="back"
          scale={resolvedScale}
          colors={colorPalette}
          border={colors.bodyDiagramBorder}
          defaultFill={colors.bodyDiagramFill}
        />
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
