/**
 * Helpers for active-workout screen tests. The workout screen is mounted through the real router
 * at `/active-workout?...` with the stores reset between tests; the tabs and paywall are stubs.
 */
import { act } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../../../../app/active-workout';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useSettingsStore } from '@/store/settingsStore';
import { renderApp, resetAppState, routeStub, setPro } from '../render';

export const PUSH = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;

/** The URL template preview builds for a template, optionally overriding the exercise list. */
export function startUrl(templateId: string, exerciseIds: readonly string[], extra = ''): string {
  return `/active-workout?templateId=${templateId}&exerciseIds=${exerciseIds.join(',')}${extra}`;
}

export const PUSH_URL = startUrl('ppl-push', PUSH.exerciseIds);

export function renderWorkout(url: string = PUSH_URL) {
  return renderApp(
    {
      'active-workout': ActiveWorkoutScreen,
      '(tabs)/index': routeStub('tabs'),
      subscription: routeStub('paywall'),
      'create-exercise': routeStub('create-exercise'),
    },
    url
  );
}

export async function resetWorkoutState({ pro = true }: { pro?: boolean } = {}): Promise<void> {
  await resetAppState();
  setPro(pro);
  useActiveWorkoutStore.setState({
    session: null,
    hydrated: true,
    restEndTime: null,
    restTotalSeconds: 120,
    restAfter: null,
    restDurationsBetweenSets: {},
    lastActivityAt: null,
  });
  useSettingsStore.setState({ weightUnit: 'kg', workoutSoundsEnabled: false });
}

/** Wait for startWorkout's async prefill (reads AsyncStorage) to settle. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

export function session() {
  return useActiveWorkoutStore.getState().session;
}
