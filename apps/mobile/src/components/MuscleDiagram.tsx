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

export type DiagramVariant = 'male' | 'female';

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
}: {
  muscleIds?: MuscleId[];
  showLabels?: boolean;
  size?: number;
  /** Override gender; if not set, uses user profile sex (male/female only). */
  variant?: DiagramVariant;
  highlightColor?: 'green' | 'orange';
}) {
  const { colors } = useTheme();
  const profile = useSettingsStore((s) => s.profile);
  const userGender = profile?.sex === 'female' ? 'female' : 'male';
  const gender = (variant ?? userGender) as 'male' | 'female';

  const useGreen = highlightColor === 'green';
  const colorPalette = useGreen ? HIGHLIGHT_GREEN : HIGHLIGHT_ORANGE;

  const slugSet = new Set<Slug>();
  muscleIds.forEach((id) => slugSet.add(MUSCLE_ID_TO_SLUG[id]));
  const data = Array.from(slugSet).map((slug) => ({ slug, intensity: 1 }));

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
