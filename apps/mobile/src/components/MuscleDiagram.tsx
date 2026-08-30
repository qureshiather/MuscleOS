import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { Slug } from 'react-native-body-highlighter';
import type { MuscleId } from '@muscleos/types';
import { useTheme, getRecoveryPalette, type ThemeColors } from '@/theme/ThemeContext';
import { useDeviceMetrics } from '@/theme/layout';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settingsStore';

/** Library figure size at `scale={1}`. */
const FIGURE_BASE_WIDTH = 200;
/** Tight enough that both views stay on one row on SE / Display Zoom. */
const PAIR_GAP = 8;
const PAIR_BASE_WIDTH = FIGURE_BASE_WIDTH * 2 + PAIR_GAP;

function scaleToFit(availableWidth: number, size: number): number {
  if (availableWidth <= 0) return size;
  return Math.min(size, availableWidth / PAIR_BASE_WIDTH);
}

/** Map our MuscleId to the body-highlighter library's Slug (one or more muscles can map to same slug). */
const MUSCLE_ID_TO_SLUG: Record<MuscleId, Slug> = {
  chest: 'chest',
  front_delts: 'deltoids',
  side_delts: 'deltoids',
  rear_delts: 'deltoids',
  traps: 'trapezius',
  lats: 'upper-back',
  rhomboids: 'upper-back',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  abs: 'abs',
  obliques: 'obliques',
  lower_back: 'lower-back',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
};

/** All slugs we track (one per unique body part in the diagram). */
const ALL_SLUGS = new Set<Slug>(Object.values(MUSCLE_ID_TO_SLUG));

export type DiagramVariant = 'male' | 'female';

function getHighlightGradient(colors: ThemeColors, mode: 'green' | 'orange'): [string, string] {
  if (mode === 'green') {
    return [colors.recoveryReady, colors.muscleHighlight];
  }
  return [colors.primary, colors.primaryDim];
}

export function MuscleDiagram({
  muscleIds = [],
  showLabels = false,
  size = 1,
  variant,
  highlightColor,
  recoveringMuscleIds,
  justTrainedMuscleIds,
}: {
  muscleIds?: MuscleId[];
  showLabels?: boolean;
  size?: number;
  variant?: DiagramVariant;
  highlightColor?: 'green' | 'orange';
  recoveringMuscleIds?: MuscleId[];
  justTrainedMuscleIds?: MuscleId[];
}) {
  const { colors } = useTheme();
  const { width } = useDeviceMetrics();
  const [rowWidth, setRowWidth] = useState(0);
  const profile = useSettingsStore((s) => s.profile);
  const userGender = profile?.sex === 'female' ? 'female' : 'male';
  const gender = (variant ?? userGender) as 'male' | 'female';

  const isRecoveryMode = recoveringMuscleIds != null;
  const useThreeStates = isRecoveryMode && (justTrainedMuscleIds?.length ?? 0) > 0;

  const recoveringSlugSet = new Set<Slug>();
  if (recoveringMuscleIds?.length) {
    recoveringMuscleIds.forEach((id) => recoveringSlugSet.add(MUSCLE_ID_TO_SLUG[id]));
  }
  const justTrainedSlugSet = new Set<Slug>();
  if (justTrainedMuscleIds?.length) {
    justTrainedMuscleIds.forEach((id) => justTrainedSlugSet.add(MUSCLE_ID_TO_SLUG[id]));
  }
  const recoveringOnlySlugSet = new Set([...recoveringSlugSet].filter((slug) => !justTrainedSlugSet.has(slug)));
  const readySlugSet = new Set([...ALL_SLUGS].filter((slug) => !recoveringSlugSet.has(slug)));

  const data = isRecoveryMode
    ? useThreeStates
      ? [
          ...Array.from(justTrainedSlugSet).map((slug) => ({ slug, intensity: 1 })),
          ...Array.from(recoveringOnlySlugSet).map((slug) => ({ slug, intensity: 2 })),
          ...Array.from(readySlugSet).map((slug) => ({ slug, intensity: 3 })),
        ]
      : [
          ...Array.from(recoveringSlugSet).map((slug) => ({ slug, intensity: 1 })),
          ...Array.from(readySlugSet).map((slug) => ({ slug, intensity: 2 })),
        ]
    : (() => {
        const slugSet = new Set<Slug>();
        muscleIds.forEach((id) => slugSet.add(MUSCLE_ID_TO_SLUG[id]));
        return Array.from(slugSet).map((slug) => ({ slug, intensity: 1 }));
      })();

  const useGreen = highlightColor === 'green';
  // Each figure is 200pt wide at scale 1. Size the pair from the real row
  // width so front + back never wrap — including inside padded cards.
  const fallbackWidth = width - spacing.lg * 4;
  const resolvedScale = scaleToFit(rowWidth > 0 ? rowWidth : fallbackWidth, size);
  const colorPalette = isRecoveryMode
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
      {showLabels && muscleIds.length > 0 && (
        <View style={styles.labels}>
          <Text style={[styles.labelText, { color: colors.textSecondary }]}>
            Targeted: {muscleIds.join(', ')}
          </Text>
        </View>
      )}
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
  labels: { width: '100%', marginTop: 8, paddingHorizontal: 8 },
  labelText: { fontSize: 12 },
});
