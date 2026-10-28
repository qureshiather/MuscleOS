import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { BODY_FIGURES, type FigureGender, type FigurePartId, type FigureSide } from '@/data/bodyFigures';
import { useTheme } from '@/theme/ThemeContext';
import type { BodyDataItem } from '@/utils/muscleDiagramRegions';

/** Figure size at `scale={1}`. */
export const FIGURE_BASE_WIDTH = 200;
const FIGURE_BASE_HEIGHT = 400;

/** Hands, feet, joints and the head sit back so the muscles read first. */
const DETAIL_OPACITY = 0.55;
const DETAILS: ReadonlySet<FigurePartId> = new Set<FigurePartId>(['ankles', 'feet', 'hands', 'head', 'knees']);

type BodyFigureProps = {
  gender: FigureGender;
  side: FigureSide;
  /** Lit regions; `intensity` indexes `colors` (1-based). Every other muscle takes the neutral fill. */
  data: readonly BodyDataItem[];
  colors: readonly string[];
  scale?: number;
};

/**
 * One body figure in the theme's diagram colours. Lit regions use the same top-to-bottom fade as
 * the template-card art (`MuscleZoomArt`).
 */
export function BodyFigure({ gender, side, data, colors, scale = 1 }: BodyFigureProps) {
  const { colors: theme } = useTheme();
  const figure = BODY_FIGURES[gender][side];
  const intensityOf = new Map(data.map((d) => [d.slug as FigurePartId, d.intensity]));
  const gradientId = (intensity: number) => `body-${gender}-${side}-${intensity}`;

  return (
    <Svg
      viewBox={figure.viewBox.join(' ')}
      width={FIGURE_BASE_WIDTH * scale}
      height={FIGURE_BASE_HEIGHT * scale}
      accessible
      accessibilityLabel={`${gender}-body-${side}`}
    >
      <Defs>
        {colors.map((color, i) => (
          <LinearGradient key={color + i} id={gradientId(i + 1)} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0.75} />
          </LinearGradient>
        ))}
      </Defs>
      <Path
        d={figure.outline}
        fill="none"
        stroke={theme.bodyDiagramBorder}
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {figure.parts.map((part) => {
        const intensity = intensityOf.get(part.id);
        const lit = intensity != null && intensity >= 1 && intensity <= colors.length;
        const fill = lit
          ? `url(#${gradientId(intensity)})`
          : part.id === 'hair'
            ? theme.bodyDiagramBorder
            : theme.bodyDiagramFill;
        const opacity = DETAILS.has(part.id) ? DETAIL_OPACITY : 1;
        return (
          <G key={part.id} id={part.id} fill={fill} fillOpacity={opacity}>
            {part.paths.map((d) => (
              <Path key={d} d={d} />
            ))}
          </G>
        );
      })}
    </Svg>
  );
}
