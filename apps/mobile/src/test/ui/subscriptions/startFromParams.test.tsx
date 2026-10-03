/**
 * Deep links / notification taps straight into /active-workout and /workout-preview — the last line
 * of defence for the Pro gates (docs/features/subscriptions.md#single-enforcement-predicate).
 */
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import ActiveWorkoutScreen from '../../../../app/active-workout';
import WorkoutPreviewScreen from '../../../../app/workout-preview';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { createEmptySession } from '@/store/activeWorkoutLogic';
import { renderApp, routeStub, setPro } from '../render';
import { CUSTOM_TEMPLATE, resetGateState, seedCustomTemplates, setSubscriptionLoading } from './helpers';

const pushIds = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')?.exerciseIds ?? [];

function renderActive(url: string) {
  return renderApp(
    { 'active-workout': ActiveWorkoutScreen, subscription: routeStub('subscription'), '(tabs)/index': routeStub('tabs') },
    url
  );
}

/** Let pending effects and microtasks settle. */
async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const session = () => useActiveWorkoutStore.getState().session;

beforeEach(resetGateState);

describe('/active-workout start from params', () => {
  test('Basic: a built-in template starts', async () => {
    renderActive('/active-workout?templateId=ppl-push');
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.templateId).toBe('ppl-push');
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(pushIds);
  });

  test('Basic: a built-in id cannot smuggle arbitrary exercises (plan comes from the template)', async () => {
    renderActive('/active-workout?templateId=ppl-push&exerciseIds=deadlift,squat&sets=9,9');
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(pushIds);
    expect(session()?.exercises[0]?.sets).toHaveLength(3);
  });

  test('Basic cold start: _empty goes to the empty_workout paywall without crashing the router', async () => {
    const r = renderActive('/active-workout?templateId=_empty');
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getPathname()).toBe('/subscription');
    expect(r.getSearchParams()).toEqual({ feature: 'empty_workout' });
    expect(session()).toBeNull();
  });

  test('Basic: an unknown template id goes to the empty_workout paywall (no ad-hoc hole)', async () => {
    const r = renderActive('/active-workout?templateId=tpl_missing&exerciseIds=deadlift');
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'empty_workout' });
    expect(session()).toBeNull();
  });

  test('Basic cold start: a custom template waits for templates to load, then hits custom_templates', async () => {
    useTemplatesStore.setState({ userTemplates: [], isLoading: true });
    const r = renderActive(`/active-workout?templateId=${CUSTOM_TEMPLATE.id}`);
    await flush();
    expect(r.getPathname()).toBe('/active-workout');
    expect(session()).toBeNull();
    act(() => seedCustomTemplates());
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'custom_templates' });
    expect(session()).toBeNull();
  });

  test('Pro: a custom template starts from the encoded plan', async () => {
    setPro(true);
    seedCustomTemplates();
    renderActive(`/active-workout?templateId=${CUSTOM_TEMPLATE.id}&exerciseIds=bench-press,lateral-raise`);
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.templateId).toBe(CUSTOM_TEMPLATE.id);
    expect(session()?.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'lateral-raise']);
  });

  test('Pro is not bounced while the tier is still loading; the workout starts once it resolves', async () => {
    setSubscriptionLoading();
    const r = renderActive('/active-workout?templateId=_empty');
    await flush();
    expect(r.getPathname()).toBe('/active-workout');
    expect(session()).toBeNull();
    act(() => setPro(true));
    await waitFor(() => expect(session()).not.toBeNull());
    expect(session()?.templateId).toBe('_empty');
    expect(r.getPathname()).toBe('/active-workout');
  });

  test('a workout already in progress is untouched by a lapse', async () => {
    seedCustomTemplates();
    const running = createEmptySession(CUSTOM_TEMPLATE.id, [{ exerciseId: 'bench-press', sets: 3, warmUpSets: 0 }]);
    useActiveWorkoutStore.setState({ session: running, hydrated: true });
    const r = renderActive(`/active-workout?templateId=${CUSTOM_TEMPLATE.id}`);
    await flush();
    expect(r.getPathname()).toBe('/active-workout');
    expect(session()?.id).toBe(running.id);
    expect(useSubscriptionStore.getState().isPro()).toBe(false);
  });
});

describe('/workout-preview guard', () => {
  function renderPreview(url: string) {
    return renderApp(
      {
        'workout-preview': WorkoutPreviewScreen,
        subscription: routeStub('subscription'),
        'active-workout': routeStub('active-workout'),
      },
      url
    );
  }

  test('Basic: a custom template redirects to the custom_templates paywall', async () => {
    seedCustomTemplates();
    const r = renderPreview(`/workout-preview?templateId=${CUSTOM_TEMPLATE.id}&exerciseIds=bench-press`);
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'custom_templates' });
  });

  test('Basic: an unknown id redirects to the empty_workout paywall', async () => {
    const r = renderPreview('/workout-preview?templateId=tpl_missing&exerciseIds=bench-press');
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ feature: 'empty_workout' });
  });

  test('Basic: a built-in previews its own exercises and Start passes the template plan', async () => {
    const r = renderPreview('/workout-preview?templateId=ppl-push&exerciseIds=deadlift');
    expect(await screen.findByText('Push')).toBeTruthy();
    expect(r.getPathname()).toBe('/workout-preview');
    fireEvent.press(screen.getByText('Start'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(r.getSearchParams()).toMatchObject({ templateId: 'ppl-push', exerciseIds: pushIds.join(',') });
  });

  test('Pro: a custom template previews (no redirect)', async () => {
    setPro(true);
    seedCustomTemplates();
    const r = renderPreview(`/workout-preview?templateId=${CUSTOM_TEMPLATE.id}&exerciseIds=bench-press`);
    expect(await screen.findByText(CUSTOM_TEMPLATE.name)).toBeTruthy();
    expect(r.getPathname()).toBe('/workout-preview');
  });
});
