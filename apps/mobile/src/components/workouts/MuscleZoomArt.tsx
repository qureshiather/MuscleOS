import { memo, useMemo } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { BODY_FIGURES, type FigureGender, type FigurePartId, type MuscleRegion } from '@/data/bodyFigures';
import { useTheme } from '@/theme/ThemeContext';
import { withAlpha } from '@/theme/palette';
import { cropToRegions } from '@/utils/bodyCrop';
import type { DiagramView, RegionState, RegionStates } from '@/utils/muscleDiagramRegions';

/** Hair sits on top of the head path and reads as noise at this zoom. */
const SKIPPED: ReadonlySet<FigurePartId> = new Set<FigurePartId>(['hair']);

type MuscleZoomArtProps = {
  /** Lit regions per view: `deltoids` is the front delt on the front figure, the rear delt on the back. */
  regions: Record<DiagramView, RegionStates>;
  /** Regions to frame; the rest stay coloured but may fall outside the crop. Empty → all lit. */
  focus: readonly MuscleRegion[];
  gender: FigureGender;
  width: number;
  height: number;
};

/**
 * Body figure zoomed onto the template's focus regions, with every lit region coloured by recovery state. Sized by the caller;
 * the crop is computed to the exact aspect so the figure fills the box.
 */
export const MuscleZoomArt = memo(function MuscleZoomArt({ regions, focus, gender, width, height }: MuscleZoomArtProps) {
  const { colors, isDark } = useTheme();
  const { side, viewBox } = useMemo(
    () => cropToRegions(
        focus.length > 0 ? focus : ([...new Set([...Object.keys(regions.front), ...Object.keys(regions.back)])] as MuscleRegion[]),
        gender,
        width / height
      ),
    [regions, focus, gender, width, height]
  );

  const stateColor: Record<RegionState, string> = {
    ready: colors.recoveryReady,
    recovering: colors.recoveryWarm,
    justTrained: colors.recoveryHot,
  };
  const unlit = withAlpha(colors.bodyDiagramFill, isDark ? 0.4 : 0.85);

  return (
    <Svg width={width} height={height} viewBox={viewBox.join(' ')}>
      <Defs>
        {(Object.keys(stateColor) as RegionState[]).map((state) => (
          <LinearGradient key={state} id={`zoom-${state}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stateColor[state]} stopOpacity={1} />
            <Stop offset="1" stopColor={stateColor[state]} stopOpacity={0.7} />
          </LinearGradient>
        ))}
      </Defs>
      {BODY_FIGURES[gender][side].parts.map((part) => {
        if (SKIPPED.has(part.id)) return null;
        const state = regions[side][part.id as MuscleRegion];
        const fill = state ? `url(#zoom-${state})` : unlit;
        return part.paths.map((d, i) => <Path key={`${part.id}-${i}`} d={d} fill={fill} />);
      })}
    </Svg>
  );
});

type ZoomFadeProps = { width: number; height: number; color: string };

/**
 * Fades the art into the card behind the label: from the left edge and up from the bottom.
 */
export function ZoomFade({ width, height, color }: ZoomFadeProps) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="zoom-fade-x" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0.08" stopColor={color} stopOpacity={1} />
          <Stop offset="0.38" stopColor={color} stopOpacity={0.7} />
          <Stop offset="0.7" stopColor={color} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="zoom-fade-y" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#zoom-fade-x)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#zoom-fade-y)" />
    </Svg>
  );
}
