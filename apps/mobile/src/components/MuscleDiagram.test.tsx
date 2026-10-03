import { act, render } from '@testing-library/react-native';
import Body from 'react-native-body-highlighter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MUSCLE_GROUPS, type MuscleId } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { darkThemeColors, lightThemeColors } from '@/theme/palette';
import { getRecoveryPalette, ThemeProvider, type ThemeColors, useTheme } from '@/theme/ThemeContext';
import { useSettingsStore } from '@/store/settingsStore';

/** docs/features/recovery.md#body-diagram — modes, palettes, and the neutral fill. */

const ALL = Object.keys(MUSCLE_GROUPS) as MuscleId[];

let themeColors: ThemeColors;
function Probe() {
  themeColors = useTheme().colors;
  return null;
}

function renderDiagram(props: Parameters<typeof MuscleDiagram>[0]) {
  const utils = render(
    <SafeAreaProvider>
      <ThemeProvider>
        <Probe />
        <MuscleDiagram {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  const bodies = utils.UNSAFE_getAllByType(Body);
  const props0 = bodies[0].props as {
    data: { slug: string; intensity: number }[];
    colors: string[];
    defaultFill: string;
    gender: string;
    side: string;
  };
  const bySlug = Object.fromEntries(props0.data.map((d) => [d.slug, d.intensity]));
  return { ...utils, bodies, body: props0, bySlug };
}

beforeEach(() => {
  useSettingsStore.setState({ profile: {} });
});

describe('getRecoveryPalette', () => {
  it.each([
    ['dark', darkThemeColors],
    ['light', lightThemeColors],
  ] as const)('maps intensities to hot / warm / ready (%s)', (_name, colors) => {
    expect(getRecoveryPalette(colors, true)).toEqual([colors.recoveryHot, colors.recoveryWarm, colors.recoveryReady]);
    expect(getRecoveryPalette(colors, false)).toEqual([colors.recoveryWarm, colors.recoveryReady]);
  });

  it('uses the documented hex values', () => {
    expect([darkThemeColors.recoveryHot, darkThemeColors.recoveryWarm, darkThemeColors.recoveryReady]).toEqual([
      '#FF4757',
      '#FFB020',
      '#3DD68C',
    ]);
    expect([lightThemeColors.recoveryHot, lightThemeColors.recoveryWarm, lightThemeColors.recoveryReady]).toEqual([
      '#DC2626',
      '#D97706',
      '#059669',
    ]);
    expect(darkThemeColors.bodyDiagramFill).toBe('#5A6070');
    expect(lightThemeColors.bodyDiagramFill).toBe('#C8CCD8');
  });
});

describe('MuscleDiagram', () => {
  it('always renders front and back figures side by side', () => {
    const { bodies } = renderDiagram({ muscleIds: ['chest'] });
    expect(bodies.map((b) => b.props.side)).toEqual(['front', 'back']);
  });

  it('uses the female figure only when the profile says female (or the variant overrides)', () => {
    expect(renderDiagram({ muscleIds: [] }).body.gender).toBe('male');
    act(() => useSettingsStore.setState({ profile: { sex: 'female' } }));
    expect(renderDiagram({ muscleIds: [] }).body.gender).toBe('female');
    expect(renderDiagram({ muscleIds: [], variant: 'male' }).body.gender).toBe('male');
  });

  it('three-state recovery: just trained 1, recovering 2, every other region ready 3', () => {
    const { body, bySlug } = renderDiagram({
      recoveringMuscleIds: ['chest', 'quads', 'front_delts'],
      justTrainedMuscleIds: ['chest'],
    });
    expect(body.colors).toEqual(getRecoveryPalette(themeColors, true));
    expect(bySlug.chest).toBe(1);
    expect(bySlug.quadriceps).toBe(2);
    expect(bySlug.deltoids).toBe(2);
    expect(bySlug.calves).toBe(3);
    expect(body.data).toHaveLength(15);
  });

  it('two-state recovery when no just-trained subset is supplied', () => {
    const { body, bySlug } = renderDiagram({ recoveringMuscleIds: ['lats'] });
    expect(body.colors).toEqual(getRecoveryPalette(themeColors, false));
    expect(bySlug['upper-back']).toBe(1); // lats + rhomboids share a region
    expect(bySlug.chest).toBe(2);
    expect(body.data).toHaveLength(15);
  });

  it('all-clear: every region highlighted in the ready green', () => {
    const { body } = renderDiagram({ muscleIds: ALL, highlightColor: 'green' });
    expect(body.data).toHaveLength(15);
    expect(body.colors[0]).toBe(themeColors.recoveryReady);
  });

  it('session mode (Good work): trained muscles just-trained, the rest neutral — not ready', () => {
    const { body, bySlug } = renderDiagram({ sessionMuscleIds: ['chest', 'triceps', 'front_delts'] });
    expect(body.colors[0]).toBe(themeColors.recoveryHot);
    expect(bySlug).toEqual({ chest: 1, triceps: 1, deltoids: 1 });
    // Every other region is left out of the data, so it paints with the neutral fill.
    expect(body.defaultFill).toBe(themeColors.bodyDiagramFill);
    expect(body.data.some((d) => d.intensity === 3)).toBe(false);
  });

  it('shows no "Targeted" label', () => {
    const { queryByText } = renderDiagram({ recoveringMuscleIds: ['chest'], justTrainedMuscleIds: ['chest'] });
    expect(queryByText(/Targeted/)).toBeNull();
  });
});
