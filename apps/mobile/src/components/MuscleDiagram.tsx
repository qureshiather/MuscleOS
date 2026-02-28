import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { Slug } from 'react-native-body-highlighter';
import type { MuscleId } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { useSettingsStore } from '@/store/settingsStore';

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

const HIGHLIGHT_RED = ['#dc2626', '#b91c1c'];
const HIGHLIGHT_ORANGE = ['#ea580c', '#c2410c'];
const HIGHLIGHT_GREEN = ['#22c55e', '#16a34a'];
const BODY_BORDER = '#4b5563';
const BODY_FILL = '#6b7280';

export function MuscleDiagram({
  muscleIds = [],
  showLabels = false,
  size = 1,
  variant,
  /** Green when "all ready" (e.g. recovery); orange when targeted/recovering */
  highlightColor,
  /** When set, show these in orange (recovering) and all other muscles in green (ready to train). */
  recoveringMuscleIds,
  /** When set with recoveringMuscleIds, these show as RED (just trained); rest of recovering show orange. */
  justTrainedMuscleIds,
}: {
  muscleIds?: MuscleId[];
  showLabels?: boolean;
  size?: number;
  /** Override gender; if not set, uses user profile sex (male/female only). */
  variant?: DiagramVariant;
  highlightColor?: 'green' | 'orange';
  recoveringMuscleIds?: MuscleId[];
  justTrainedMuscleIds?: MuscleId[];
}) {
  const { colors } = useTheme();
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
  const colorPalette = isRecoveryMode
    ? useThreeStates
      ? [HIGHLIGHT_RED[0], HIGHLIGHT_ORANGE[0], HIGHLIGHT_GREEN[0]]
      : [HIGHLIGHT_ORANGE[0], HIGHLIGHT_GREEN[0]]
    : useGreen
      ? HIGHLIGHT_GREEN
      : HIGHLIGHT_ORANGE;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Body
          data={data}
          gender={gender}
          side="front"
          scale={size}
          colors={colorPalette}
          border={BODY_BORDER}
          defaultFill={BODY_FILL}
        />
        <Body
          data={data}
          gender={gender}
          side="back"
          scale={size}
          colors={colorPalette}
          border={BODY_BORDER}
          defaultFill={BODY_FILL}
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
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  labels: { width: '100%', marginTop: 8, paddingHorizontal: 8 },
  labelText: { fontSize: 12 },
});
