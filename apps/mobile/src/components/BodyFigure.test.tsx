import { render } from '@testing-library/react-native';
import { G, LinearGradient, Path } from 'react-native-svg';
import { BodyFigure } from '@/components/BodyFigure';
import { ThemeProvider, type ThemeColors, useTheme } from '@/theme/ThemeContext';

/** docs/features/recovery.md#body-diagram — the figure's own rendering. */

let theme: ThemeColors;
function Probe() {
  theme = useTheme().colors;
  return null;
}

function renderFigure(props: Parameters<typeof BodyFigure>[0]) {
  const utils = render(
    <ThemeProvider>
      <Probe />
      <BodyFigure {...props} />
    </ThemeProvider>
  );
  const parts = Object.fromEntries(
    utils.UNSAFE_getAllByType(G).map((g) => [g.props.id, g.props as { fill: string; fillOpacity: number }])
  );
  return { ...utils, parts };
}

describe('BodyFigure', () => {
  it('fills lit regions with their palette gradient and every other muscle with the neutral fill', () => {
    const { parts, UNSAFE_getAllByType } = renderFigure({
      gender: 'male',
      side: 'back',
      data: [{ slug: 'lats', intensity: 2 }],
      colors: ['red', 'blue'],
    });
    expect(parts.lats.fill).toBe('url(#body-male-back-2)');
    const gradient = UNSAFE_getAllByType(LinearGradient).find((g) => g.props.id === 'body-male-back-2');
    expect(gradient?.props.children[0].props.stopColor).toBe('blue');
    expect(parts['upper-back'].fill).toBe(theme.bodyDiagramFill);
    expect(parts.trapezius.fill).toBe(theme.bodyDiagramFill);
  });

  it('draws the lats and the shoulder blades as separate regions (MUS-176)', () => {
    for (const gender of ['male', 'female'] as const) {
      const { parts } = renderFigure({ gender, side: 'back', data: [{ slug: 'upper-back', intensity: 1 }], colors: ['red'] });
      expect(parts['upper-back'].fill).toBe(`url(#body-${gender}-back-1)`);
      expect(parts.lats.fill).toBe(theme.bodyDiagramFill);
    }
  });

  it('ignores an intensity outside the palette', () => {
    const { parts } = renderFigure({ gender: 'male', side: 'front', data: [{ slug: 'chest', intensity: 3 }], colors: ['red'] });
    expect(parts.chest.fill).toBe(theme.bodyDiagramFill);
  });

  it('keeps hands, feet, joints and the head muted, hair in the border colour, and outlines the silhouette', () => {
    const { parts, UNSAFE_getAllByType } = renderFigure({ gender: 'male', side: 'front', data: [], colors: ['red'] });
    for (const id of ['hands', 'feet', 'knees', 'ankles', 'head']) expect(parts[id].fillOpacity).toBeLessThan(1);
    expect(parts.chest.fillOpacity).toBe(1);
    expect(parts.hair.fill).toBe(theme.bodyDiagramBorder);
    const outline = UNSAFE_getAllByType(Path).find((p) => p.props.fill === 'none');
    expect(outline?.props.stroke).toBe(theme.bodyDiagramBorder);
  });

  it('sizes the figure 200 × 400 at scale 1', () => {
    const { getByLabelText } = renderFigure({ gender: 'female', side: 'front', data: [], colors: [], scale: 0.5 });
    const svg = getByLabelText('female-body-front');
    expect([svg.props.width, svg.props.height]).toEqual([100, 200]);
  });
});
