/**
 * Programs and program detail — docs/features/templates.md#programs. Real screens and settings
 * store; the Workouts tab and the preview are stubs.
 */
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import ProgramsScreen from '../../../../app/programs';
import ProgramScreen from '../../../../app/program';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_SETTINGS_KEYS, getAppSettings } from '@/storage/localStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { routeStub } from '../render';
import { pathname, renderAtNow, resetTemplatesTestState, searchParams, seed } from './helpers';

jest.mock('@/sync', () => ({
  notifyAppSettingsSnapshot: jest.fn(),
}));

const routes = {
  '(tabs)/index': routeStub('workouts'),
  programs: ProgramsScreen,
  program: ProgramScreen,
  'workout-preview': routeStub('workout-preview'),
  'create-template': routeStub('create-template'),
  'active-workout': routeStub('active-workout'),
};

beforeEach(async () => {
  await resetTemplatesTestState();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Programs', () => {
  it('lists every program in shipped order with its level and size', async () => {
    renderAtNow(routes, '/programs');
    const cards = await screen.findAllByTestId(/^program-card-/);
    expect(cards.map((c) => c.props.testID)).toEqual([
      'program-card-none',
      'program-card-builtin_sl',
      'program-card-builtin_ppl',
      'program-card-builtin_ul',
      'program-card-builtin_phul',
    ]);
    expect(screen.getByText('3 days/wk · 2 workouts')).toBeTruthy();
    expect(screen.getAllByText('Beginner')).toHaveLength(2);
    expect(screen.queryByText('In your workouts')).toBeNull();
  });

  it('lists the chosen program first and marks it', async () => {
    await seed({ activeProgramId: 'builtin_phul' });
    renderAtNow(routes, '/programs');
    const cards = await screen.findAllByTestId(/^program-card-/);
    expect(cards[0].props.testID).toBe('program-card-builtin_phul');
    expect(cards.at(-1)?.props.testID).toBe('program-card-none');
    expect(screen.getByLabelText('PHUL, in your workouts')).toBeTruthy();
    expect(screen.getByText('In your workouts')).toBeTruthy();
  });

  it('No program starts selected and offers Build a template and Start empty workout', async () => {
    renderAtNow(routes, '/programs');
    expect(await screen.findByLabelText('No program, selected')).toBeTruthy();
    expect(
      screen.getByText('Great. Make your own templates, or just start a workout and add exercises as you go.')
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Build a template'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
  });

  it('Start empty workout goes straight to an empty session', async () => {
    renderAtNow(routes, '/programs');
    fireEvent.press(await screen.findByText('Start empty workout'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(searchParams()).toEqual({ templateId: '_empty', exerciseIds: '' });
  });

  it('choosing No program drops the program and stays on Programs', async () => {
    await seed({ activeProgramId: 'builtin_ppl' });
    renderAtNow(routes, '/programs');
    expect(screen.queryByText('Build a template')).toBeNull();
    fireEvent.press(await screen.findByLabelText('No program'));
    await waitFor(() => expect(useSettingsStore.getState().activeProgramId).toBeNull());
    expect(await screen.findByText('Build a template')).toBeTruthy();
    expect(screen.queryByText('In your workouts')).toBeNull();
    expect(pathname()).toBe('/programs');
  });

  it('a card opens its program', async () => {
    renderAtNow(routes, '/programs');
    fireEvent.press(await screen.findByTestId('program-card-builtin_ul'));
    expect(await screen.findByText('Two upper and two lower days, each pair with a different focus.')).toBeTruthy();
    expect(pathname()).toBe('/program');
    expect(searchParams()).toEqual({ id: 'builtin_ul' });
  });
});

describe('program detail', () => {
  it('shows the facts and every workout with its exercises; a workout opens its preview', async () => {
    renderAtNow(routes, '/program?id=builtin_sl');
    expect(await screen.findByText('Strong Lifts 5x5')).toBeTruthy();
    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.queryByText('In your workouts')).toBeNull();
    expect(screen.getByText('3 days/wk')).toBeTruthy();
    expect(screen.getByText('2 workouts')).toBeTruthy();
    expect(screen.getByText('30 sets/cycle')).toBeTruthy();
    expect(screen.getByText('DAY 1')).toBeTruthy();
    expect(screen.getByTestId('program-day-sl-a')).toBeTruthy();
    expect(screen.getByText('5 sets of 5 reps. Alternating with B.')).toBeTruthy();
    expect(screen.getAllByText('3 exercises · 15 sets').length).toBe(2);
    expect(screen.getAllByText('Barbell Squat').length).toBe(2);
    expect(screen.getAllByText('5×').length).toBe(6);
    expect(screen.getAllByText('Quads').length).toBe(2);
    fireEvent.press(screen.getByLabelText('Preview Workout B'));
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(searchParams()).toEqual({
      templateId: 'sl-b',
      exerciseIds: 'squat,overhead-press,deadlift',
      sets: '5,5,5',
    });
  });

  it('with no program, Add to your workouts chooses it and returns to Workouts', async () => {
    renderAtNow(routes, '/program?id=builtin_ppl');
    expect(await screen.findByText('Its workouts join your templates on the Workouts tab.')).toBeTruthy();
    fireEvent.press(screen.getByText('Add to your workouts'));
    expect(await screen.findByText('route:workouts')).toBeTruthy();
    expect(useSettingsStore.getState().activeProgramId).toBe('builtin_ppl');
    expect(await AsyncStorage.getItem(APP_SETTINGS_KEYS.activeProgram)).toBe('builtin_ppl');
  });

  it('with another program, Switch to replaces it', async () => {
    await seed({ activeProgramId: 'builtin_ppl' });
    renderAtNow(routes, '/program?id=builtin_phul');
    expect(
      await screen.findByText('Replaces Push Pull Legs in Your workouts. Your templates and history stay.')
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Switch to PHUL'));
    await waitFor(() => expect(useSettingsStore.getState().activeProgramId).toBe('builtin_phul'));
  });

  it('on the chosen program, Remove from your workouts goes back to no program', async () => {
    await seed({ activeProgramId: 'builtin_sl' });
    renderAtNow(routes, '/program?id=builtin_sl');
    expect(await screen.findByText('In your workouts')).toBeTruthy();
    fireEvent.press(await screen.findByText('Remove from your workouts'));
    expect(await screen.findByText('route:workouts')).toBeTruthy();
    expect(useSettingsStore.getState().activeProgramId).toBeNull();
    await waitFor(async () => expect((await getAppSettings()).activeProgramId).toBeNull());
  });

  it('an unknown id shows Program not found', async () => {
    renderAtNow(routes, '/program?id=builtin_gone');
    expect(await screen.findByText('Program not found')).toBeTruthy();
  });
});
