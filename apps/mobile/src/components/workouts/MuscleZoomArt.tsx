import { memo, useMemo } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { BodyPart, Slug } from 'react-native-body-highlighter';
import { bodyFront } from 'react-native-body-highlighter/dist/assets/bodyFront';
import { bodyBack } from 'react-native-body-highlighter/dist/assets/bodyBack';
import { bodyFemaleFront } from 'react-native-body-highlighter/dist/assets/bodyFemaleFront';
import { bodyFemaleBack } from 'react-native-body-highlighter/dist/assets/bodyFemaleBack';
import { useTheme } from '@/theme/ThemeContext';
import { withAlpha } from '@/theme/palette';
import { cropToRegions, type FigureGender, type FigureSide } from '@/utils/bodyCrop';
import type { RegionState } from '@/utils/muscleDiagramRegions';

const FIGURES: Record<FigureGender, Record<FigureSide, BodyPart[]>> = {
  male: { front: bodyFront, back: bodyBack },
  female: { front: bodyFemaleFront, back: bodyFemaleBack },
};

/** Hair sits on top of the head path and reads as noise at this zoom. */
const SKIPPED: ReadonlySet<Slug> = new Set<Slug>(['hair']);

function pathsOf(part: BodyPart): string[] {
  const p = part.path;
  return [...(p?.left ?? []), ...(p?.right ?? []), ...(p?.common ?? [])];
}

type MuscleZoomArtProps = {
  regions: Partial<Record<Slug, RegionState>>;
  gender: FigureGender;
  width: number;
  height: number;
};

/**
 * Body figure zoomed onto the lit regions, each coloured by recovery state. Sized by the caller;
 * the crop is computed to the exact aspect so the figure fills the box.
 */
export const MuscleZoomArt = memo(function MuscleZoomArt({ regions, gender, width, height }: MuscleZoomArtProps) {
  const { colors, isDark } = useTheme();
  const { side, viewBox } = useMemo(
    () => cropToRegions(Object.keys(regions) as Slug[], gender, width / height),
    [regions, gender, width, height]
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
      {FIGURES[gender][side].map((part) => {
        if (!part.slug || SKIPPED.has(part.slug)) return null;
        const state = regions[part.slug];
        const fill = state ? `url(#zoom-${state})` : unlit;
        return pathsOf(part).map((d, i) => <Path key={`${part.slug}-${i}`} d={d} fill={fill} />);
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
