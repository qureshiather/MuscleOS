import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MUSCLE_GROUPS, type MuscleId } from '@muscleos/types';
import { BodyFigure } from '@/components/BodyFigure';
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
  const bodies = utils.UNSAFE_getAllByType(BodyFigure);
  const props0 = bodies[0].props as Parameters<typeof BodyFigure>[0];
  const highlighted = props0.data;
  const bySlug: Record<string, number> = Object.fromEntries(highlighted.map((d) => [d.slug, d.intensity]));
  return { ...utils, bodies, body: props0, bySlug, highlighted };
}

beforeEach(() => {
  useSettingsStore.setState({ profile: {} });
});

describe('getRecoveryPalette', () => {
  it.each([
    ['dark', darkThemeColors],
    ['light', lightThemeColors],
  ] as const)('maps intensities to hot / warm / ready (%s)', (_name, colors) => {
    expect(getRecoveryPalette(colors)).toEqual([colors.recoveryHot, colors.recoveryWarm, colors.recoveryReady]);
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

  it('lights the deltoids only on the side the delt head is on (MUS-140)', () => {
    const intensities = (bodies: ReturnType<typeof renderDiagram>['bodies']) =>
      bodies.map((b) =>
        (b.props.data as { slug: string; intensity?: number }[]).find((d) => d.slug === 'deltoids')?.intensity
      );
    // A pull day: rear delts light the back figure's shoulders, not the front's.
    expect(intensities(renderDiagram({ muscleIds: ['lats', 'rear_delts'] }).bodies)).toEqual([undefined, 1]);
    expect(intensities(renderDiagram({ muscleIds: ['front_delts'] }).bodies)).toEqual([1, undefined]);
    expect(intensities(renderDiagram({ muscleIds: ['side_delts'] }).bodies)).toEqual([1, 1]);
    // Recovery: each figure's deltoids take the state of their own side's heads.
    expect(
      intensities(renderDiagram({ recoveringMuscleIds: ['rear_delts'], justTrainedMuscleIds: ['rear_delts'] }).bodies)
    ).toEqual([3, 1]);
  });

  it('lights lats and rhomboids as different regions (MUS-176)', () => {
    const lats = renderDiagram({ muscleIds: ['lats'] });
    expect(lats.bySlug).toEqual({ lats: 1 });
    const rhomboids = renderDiagram({ muscleIds: ['rhomboids'] });
    expect(rhomboids.bySlug).toEqual({ 'upper-back': 1 });
  });

  it('lights the shin for a tibialis raise and the neck for neck work, not calves or traps (MUS-171)', () => {
    const tib = renderDiagram({ muscleIds: ['tibialis'] });
    expect(tib.bySlug).toEqual({ tibialis: 1 });
    const neck = renderDiagram({ muscleIds: ['neck'] });
    expect(neck.bySlug).toEqual({ neck: 1 });
  });

  it('uses the female figure only when the profile says female (or the variant overrides)', () => {
    expect(renderDiagram({ muscleIds: [] }).body.gender).toBe('male');
    act(() => useSettingsStore.setState({ profile: { sex: 'female' } }));
    expect(renderDiagram({ muscleIds: [] }).body.gender).toBe('female');
    expect(renderDiagram({ muscleIds: [], variant: 'male' }).body.gender).toBe('male');
  });

  it('three-state recovery: just trained 1, recovering 2, every other region ready 3', () => {
    const { body, highlighted, bySlug } = renderDiagram({
      recoveringMuscleIds: ['chest', 'quads', 'front_delts'],
      justTrainedMuscleIds: ['chest'],
    });
    expect(body.colors).toEqual(getRecoveryPalette(themeColors));
    expect(bySlug.chest).toBe(1);
    expect(bySlug.quadriceps).toBe(2);
    expect(bySlug.deltoids).toBe(2);
    expect(bySlug.calves).toBe(3);
    expect(highlighted).toHaveLength(18);
  });

  it('recovery without a just-trained subset still uses the three-state palette', () => {
    const { body, highlighted, bySlug } = renderDiagram({ recoveringMuscleIds: ['lats'] });
    expect(body.colors).toEqual(getRecoveryPalette(themeColors));
    expect(bySlug.lats).toBe(2);
    expect(bySlug['upper-back']).toBe(3); // rhomboids: their own region, still ready
    expect(bySlug.chest).toBe(3);
    expect(highlighted).toHaveLength(18);
  });

  it('all-clear: every region highlighted in the ready green', () => {
    const { body, highlighted } = renderDiagram({ muscleIds: ALL, highlightColor: 'green' });
    expect(highlighted).toHaveLength(18);
    expect(body.colors[0]).toBe(themeColors.recoveryReady);
  });

  it('session mode (Good work): trained muscles just-trained, the rest neutral — not ready', () => {
    const { body, bySlug, highlighted } = renderDiagram({
      sessionMuscleIds: ['chest', 'triceps', 'front_delts'],
    });
    expect(body.colors[0]).toBe(themeColors.recoveryHot);
    expect(bySlug).toEqual({ chest: 1, triceps: 1, deltoids: 1 });
    expect(highlighted.some((d) => d.intensity === 3)).toBe(false);
  });

  it('shows no "Targeted" label', () => {
    const { queryByText } = renderDiagram({ recoveringMuscleIds: ['chest'], justTrainedMuscleIds: ['chest'] });
    expect(queryByText(/Targeted/)).toBeNull();
  });
});
