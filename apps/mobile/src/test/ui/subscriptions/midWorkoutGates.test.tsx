/**
 * Mid-workout rows of the gate map: add / replace / remove, save as / overwrite template, and the
 * built-in workout alert (docs/features/subscriptions.md#gate-map).
 */
import { Alert } from 'react-native';
import type { WorkoutSession } from '@muscleos/types';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import ActiveWorkoutScreen from '../../../../app/active-workout';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { renderApp, setPro } from '../render';
import { CUSTOM_TEMPLATE, resetGateState, seedCustomTemplates, stubs } from './helpers';

const BUILT_IN_ALERT = [
  'Built-in workout',
  'You can’t edit a built-in workout. Upgrade to Pro to customize it and save it as a new template.',
];

/** One completed bench set — enough to enable Finish. Differs from every template's list. */
function seedSession(templateId: string): WorkoutSession {
  const session: WorkoutSession = {
    id: 'session_live',
    templateId,
    startedAt: new Date().toISOString(),
    exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
  };
  useActiveWorkoutStore.setState({ session, hydrated: true });
  return session;
}

function render() {
  return renderApp(
    {
      'active-workout': ActiveWorkoutScreen,
      subscription: stubs.subscription,
      'create-exercise': stubs['create-exercise'],
      '(tabs)/index': stubs['active-workout'],
    },
    '/active-workout'
  );
}

async function settle() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function expectPaywall(r: ReturnType<typeof render>, feature: string) {
  expect(await screen.findByText('route:subscription')).toBeTruthy();
  expect(r.getSearchParams()).toEqual({ feature });
}

/** Open the first exercise's menu: the dropdown renders once its hidden sizing copy has laid out. */
async function openMenu() {
  fireEvent.press(await screen.findByTestId('exercise-menu-0'));
  // Mocked host views never answer measureInWindow; make every mounted one report a box.
  for (const node of screen.UNSAFE_root.findAll(
    (n) => typeof (n.instance as { measureInWindow?: unknown } | null)?.measureInWindow === 'function'
  )) {
    (node.instance as { measureInWindow: unknown }).measureInWindow = (
      cb: (x: number, y: number, w: number, h: number) => void
    ) => cb(0, 0, 200, 40);
  }
  const sizing = screen.UNSAFE_getByProps({ pointerEvents: 'none', collapsable: false });
  fireEvent(sizing, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 40 } } });
  await screen.findByTestId('exercise-menu-replace');
}

async function openMenuItem(testID: string) {
  await openMenu();
  fireEvent.press(screen.getAllByTestId(testID).at(-1) as never);
}

let alertSpy: jest.SpyInstance;

beforeEach(async () => {
  await resetGateState();
  seedCustomTemplates();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alertSpy.mockRestore());

describe('custom-template workout', () => {
  beforeEach(() => {
    seedSession(CUSTOM_TEMPLATE.id);
  });

  test('Basic: Add Exercise is labelled Pro and opens the add_exercise_mid_workout paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByText('Pro: Add Exercise'));
    await expectPaywall(r, 'add_exercise_mid_workout');
  });

  test('Pro: Add Exercise opens the picker', async () => {
    setPro(true);
    const r = render();
    fireEvent.press(await screen.findByText('Add Exercise'));
    await settle();
    expect(r.getPathname()).toBe('/active-workout');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('Basic: Replace (shown locked) opens the replace_exercise_mid_workout paywall', async () => {
    const r = render();
    await openMenu();
    expect(screen.getAllByLabelText('Replace exercise, Pro').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('exercise-menu-replace'));
    await expectPaywall(r, 'replace_exercise_mid_workout');
  });

  test('Basic: Remove is allowed (confirm dialog, no paywall)', async () => {
    const r = render();
    await openMenuItem('exercise-menu-remove');
    expect(await screen.findByText('Remove exercise')).toBeTruthy();
    expect(r.getPathname()).toBe('/active-workout');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('Basic: Overwrite this template opens the save_as_template paywall and leaves the workout running', async () => {
    const r = render();
    fireEvent.press(await screen.findByText('Finish'));
    fireEvent.press(await screen.findByText('Overwrite this template'));
    await expectPaywall(r, 'save_as_template');
    expect(useActiveWorkoutStore.getState().session?.id).toBe('session_live');
    expect(useTemplatesStore.getState().userTemplates[0]?.exerciseIds).toEqual(CUSTOM_TEMPLATE.exerciseIds);
  });

  test('Basic: Save as new template opens the save_as_template paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByText('Finish'));
    fireEvent.press(await screen.findByText('Save as new template'));
    await expectPaywall(r, 'save_as_template');
    expect(useActiveWorkoutStore.getState().session?.id).toBe('session_live');
  });

  test('Pro: Overwrite this template updates the template and finishes', async () => {
    setPro(true);
    render();
    fireEvent.press(await screen.findByText('Finish'));
    await act(async () => {
      fireEvent.press(await screen.findByText('Overwrite this template'));
    });
    expect(await screen.findByText('Good work')).toBeTruthy();
    expect(useTemplatesStore.getState().userTemplates[0]?.exerciseIds).toEqual(['bench-press']);
  });
});

describe('built-in workout on Basic', () => {
  beforeEach(() => {
    seedSession('ppl-push');
  });

  test('Add shows the built-in alert, not the paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByText('Pro: Add Exercise'));
    expect(alertSpy).toHaveBeenCalledWith(...BUILT_IN_ALERT);
    expect(r.getPathname()).toBe('/active-workout');
  });

  test.each(['exercise-menu-replace', 'exercise-menu-remove'])('%s shows the built-in alert', async (testID) => {
    const r = render();
    await openMenuItem(testID);
    expect(alertSpy).toHaveBeenCalledWith(...BUILT_IN_ALERT);
    expect(r.getPathname()).toBe('/active-workout');
  });

  test('Pro: Replace opens the picker (no alert)', async () => {
    setPro(true);
    const r = render();
    await openMenuItem('exercise-menu-replace');
    await settle();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(r.getPathname()).toBe('/active-workout');
  });

  test('Save as new template opens the save_as_template paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByText('Finish'));
    fireEvent.press(await screen.findByText('Save as new template'));
    await expectPaywall(r, 'save_as_template');
  });
});

describe('empty workout', () => {
  test('a lapsed empty workout in progress can still be finished; Save as template is gated', async () => {
    seedSession('_empty');
    const r = render();
    fireEvent.press(await screen.findByText('Finish'));
    fireEvent.press(await screen.findByText('Save as template'));
    await expectPaywall(r, 'save_as_template');
  });
});
