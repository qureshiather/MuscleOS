import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import type { MuscleId } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';

const W = 120;
const H = 220;

/** Anatomy diagram: grayscale body with accent color for highlighted muscles. */
const BODY_GRAY = '#6b7280';
const MUSCLE_ACCENT = '#ea580c';
const READY_GREEN = '#22c55e';
const READY_GREEN_STROKE = '#16a34a';

export type DiagramVariant = 'male' | 'female';

export function MuscleDiagram({
  muscleIds = [],
  showLabels = false,
  size = 1,
  variant = 'male',
  /** Green when "all ready" (e.g. recovery); orange when targeted/recovering */
  highlightColor,
}: {
  muscleIds?: MuscleId[];
  showLabels?: boolean;
  size?: number;
  variant?: DiagramVariant;
  highlightColor?: 'green' | 'orange';
}) {
  const { colors } = useTheme();
  const highlight = new Set(muscleIds);
  const useGreen = highlightColor === 'green';
  const fillColor = useGreen ? READY_GREEN : MUSCLE_ACCENT;
  const strokeColor = useGreen ? READY_GREEN_STROKE : '#c2410c';
  const fill = (id: MuscleId) => (highlight.has(id) ? fillColor : BODY_GRAY);
  const stroke = (id: MuscleId) => (highlight.has(id) ? strokeColor : '#4b5563');

  const isFemale = variant === 'female';
  const chestRx = isFemale ? 24 : 28;
  const chestRy = isFemale ? 20 : 22;
  const shoulderOffset = isFemale ? 28 : 32;
  const hipW = isFemale ? 22 : 20;
  const quadInset = isFemale ? 16 : 18;

  return (
    <View style={[styles.wrapper, { width: W * size * 2 + 24, height: H * size + 40 }]}>
      <View style={styles.row}>
        <Svg width={W * size} height={H * size} viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
          <Ellipse cx={W / 2} cy={18} rx={isFemale ? 12 : 14} ry={16} fill={BODY_GRAY} stroke="#4b5563" />
          <Path d={`M ${W/2 - 8} 34 L ${W/2 + 8} 34 L ${W/2 + 12} 50 L ${W/2 - 12} 50 Z`} fill={BODY_GRAY} stroke="#4b5563" />
          <Ellipse cx={W / 2} cy={72} rx={chestRx} ry={chestRy} fill={fill('chest')} stroke={stroke('chest')} />
          <Ellipse cx={W / 2 - shoulderOffset} cy={68} rx={isFemale ? 8 : 10} ry={12} fill={fill('front_delts')} stroke={stroke('front_delts')} />
          <Ellipse cx={W / 2 + shoulderOffset} cy={68} rx={isFemale ? 8 : 10} ry={12} fill={fill('front_delts')} stroke={stroke('front_delts')} />
          <Ellipse cx={W / 2 - (isFemale ? 34 : 38)} cy={75} rx={8} ry={10} fill={fill('side_delts')} stroke={stroke('side_delts')} />
          <Ellipse cx={W / 2 + (isFemale ? 34 : 38)} cy={75} rx={8} ry={10} fill={fill('side_delts')} stroke={stroke('side_delts')} />
          <Path d={`M ${W/2 - 22} 98 L ${W/2 + 22} 98 L ${W/2 + hipW} 140 L ${W/2 - hipW} 140 Z`} fill={fill('abs')} stroke={stroke('abs')} />
          <Path d={`M ${W/2 - 22} 115 L ${W/2 - 28} 135 L ${W/2 - hipW} 140 L ${W/2 - 18} 118 Z`} fill={fill('obliques')} stroke={stroke('obliques')} />
          <Path d={`M ${W/2 + 22} 115 L ${W/2 + 28} 135 L ${W/2 + hipW} 140 L ${W/2 + 18} 118 Z`} fill={fill('obliques')} stroke={stroke('obliques')} />
          <Ellipse cx={W / 2 - shoulderOffset} cy={95} rx={8} ry={28} fill={fill('biceps')} stroke={stroke('biceps')} />
          <Ellipse cx={W / 2 + shoulderOffset} cy={95} rx={8} ry={28} fill={fill('biceps')} stroke={stroke('biceps')} />
          <Ellipse cx={W / 2 - (isFemale ? 26 : 30)} cy={110} rx={6} ry={20} fill={fill('triceps')} stroke={stroke('triceps')} />
          <Ellipse cx={W / 2 + (isFemale ? 26 : 30)} cy={110} rx={6} ry={20} fill={fill('triceps')} stroke={stroke('triceps')} />
          <Ellipse cx={W / 2 - 30} cy={155} rx={6} ry={22} fill={fill('forearms')} stroke={stroke('forearms')} />
          <Ellipse cx={W / 2 + 30} cy={155} rx={6} ry={22} fill={fill('forearms')} stroke={stroke('forearms')} />
          <Path d={`M ${W/2 - quadInset} 142 L ${W/2 - 22} 200 L ${W/2 - 10} 218 L ${W/2 + 2} 200 L ${W/2 - 8} 142 Z`} fill={fill('quads')} stroke={stroke('quads')} />
          <Path d={`M ${W/2 + quadInset} 142 L ${W/2 + 22} 200 L ${W/2 + 10} 218 L ${W/2 - 2} 200 L ${W/2 + 8} 142 Z`} fill={fill('quads')} stroke={stroke('quads')} />
        </Svg>
        <Svg width={W * size} height={H * size} viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
          <Ellipse cx={W / 2} cy={18} rx={14} ry={16} fill={BODY_GRAY} stroke="#4b5563" />
          <Path d={`M ${W/2 - 8} 34 L ${W/2 + 8} 34 L ${W/2 + 12} 50 L ${W/2 - 12} 50 Z`} fill={BODY_GRAY} stroke="#4b5563" />
          <Path d={`M ${W/2 - (isFemale ? 22 : 25)} 42 L ${W/2 - 18} 75 L ${W/2 + 18} 75 L ${W/2 + (isFemale ? 22 : 25)} 42 Z`} fill={fill('traps')} stroke={stroke('traps')} />
          <Ellipse cx={W / 2 - shoulderOffset} cy={72} rx={10} ry={10} fill={fill('rear_delts')} stroke={stroke('rear_delts')} />
          <Ellipse cx={W / 2 + shoulderOffset} cy={72} rx={10} ry={10} fill={fill('rear_delts')} stroke={stroke('rear_delts')} />
          <Path d={`M ${W/2 - 28} 78 L ${W/2 - 32} 130 L ${W/2 - 12} 128 L ${W/2 - 18} 82 Z`} fill={fill('lats')} stroke={stroke('lats')} />
          <Path d={`M ${W/2 + 28} 78 L ${W/2 + 32} 130 L ${W/2 + 12} 128 L ${W/2 + 18} 82 Z`} fill={fill('lats')} stroke={stroke('lats')} />
          <Path d={`M ${W/2 - 14} 70 L ${W/2 - 18} 95 L ${W/2} 92 L ${W/2 + 18} 95 L ${W/2 + 14} 70 Z`} fill={fill('rhomboids')} stroke={stroke('rhomboids')} />
          <Path d={`M ${W/2 - 18} 98 L ${W/2 + 18} 98 L ${W/2 + 16} 138 L ${W/2 - 16} 138 Z`} fill={fill('lower_back')} stroke={stroke('lower_back')} />
          <Path d={`M ${W/2 - 16} 138 L ${W/2 - 20} 168 L ${W/2 - 8} 172 L ${W/2 + 8} 172 L ${W/2 + 20} 168 L ${W/2 + 16} 138 Z`} fill={fill('glutes')} stroke={stroke('glutes')} />
          <Path d={`M ${W/2 - 12} 172 L ${W/2 - 18} 208 L ${W/2 - 6} 218 L ${W/2 + 6} 218 L ${W/2 + 18} 208 L ${W/2 + 12} 172 Z`} fill={fill('hamstrings')} stroke={stroke('hamstrings')} />
          <Ellipse cx={W / 2 - 8} cy={210} rx={6} ry={18} fill={fill('calves')} stroke={stroke('calves')} />
          <Ellipse cx={W / 2 + 8} cy={210} rx={6} ry={18} fill={fill('calves')} stroke={stroke('calves')} />
        </Svg>
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
  row: { flexDirection: 'row', gap: 12 },
  svg: {},
  labels: { marginTop: 8, paddingHorizontal: 8 },
  labelText: { fontSize: 12 },
});
