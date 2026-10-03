/**
 * Workout preview — docs/features/templates.md#workout-preview. The Pro guard itself is covered
 * with the subscription gates; this file covers what the preview shows and where Start goes.
 */
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import WorkoutPreviewScreen from '../../../../app/workout-preview';
import { useSettingsStore } from '@/store/settingsStore';
import { routeStub, setPro } from '../render';
import {
  pathname,
  renderAtNow,
  resetTemplatesTestState,
  searchParams,
  seed,
  startActiveSession,
} from './helpers';

jest.mock('@/sync', () => ({
  notifyTemplateUpsert: jest.fn(),
  notifyTemplateDelete: jest.fn(),
  notifyFolderUpsert: jest.fn(),
  notifyFolderDelete: jest.fn(),
}));

const routes = {
  index: routeStub('home'),
  'workout-preview': WorkoutPreviewScreen,
  'active-workout': routeStub('active-workout'),
  subscription: routeStub('subscription'),
};

const SL_A = '/workout-preview?templateId=sl-a&exerciseIds=squat,bench-press,barbell-row&sets=5,5,5';

beforeEach(async () => {
  await resetTemplatesTestState();
  useSettingsStore.setState({ weightUnit: 'kg' });
});

afterEach(() => {
  jest.useRealTimers();
});

it('no exercises to show → "Missing workout details"', async () => {
  // Pro, an id that resolves to no template, and no URL exercises: nothing to preview.
  setPro(true);
  renderAtNow(routes, '/workout-preview?templateId=not-a-template');
  expect(await screen.findByText('Missing workout details')).toBeTruthy();
  expect(screen.queryByText('Start workout')).toBeNull();
});

it('a built-in with no URL exercises previews its own exercises', async () => {
  renderAtNow(routes, '/workout-preview?templateId=sl-a');
  expect(await screen.findByText('Barbell Squat')).toBeTruthy();
  expect(screen.queryByText('Missing workout details')).toBeNull();
});

it('missing template id → "Missing workout details"', async () => {
  renderAtNow(routes, '/workout-preview?exerciseIds=squat');
  expect(await screen.findByText('Missing workout details')).toBeTruthy();
});

it('a workout already in progress redirects to /active-workout', async () => {
  // Pushed from Home, as in the app: the guard's router.replace runs in an effect, which can't
  // fire before the root navigator has mounted on a cold-start deep link.
  startActiveSession();
  renderAtNow(routes, '/');
  await screen.findByText('route:home');
  act(() => router.push(SL_A));
  expect(await screen.findByText('route:active-workout')).toBeTruthy();
  expect(pathname()).toBe('/active-workout');
});

it('shows the template name, Muscles used, the count line, and one card per exercise', async () => {
  renderAtNow(routes, SL_A);
  expect(await screen.findByText('Workout A')).toBeTruthy();
  expect(screen.getByText('Muscles used')).toBeTruthy();
  expect(screen.getByText('3 exercises · review, then start')).toBeTruthy();
  expect(screen.getByText('01')).toBeTruthy();
  expect(screen.getByText('03')).toBeTruthy();
  expect(screen.getByText('Barbell Squat')).toBeTruthy();
  expect(screen.getByText('Bench Press')).toBeTruthy();
  expect(screen.getAllByText('5 sets')).toHaveLength(3);
});

it('formats the set prescription with warm-ups', async () => {
  renderAtNow(routes, '/workout-preview?templateId=tpl_x&exerciseIds=squat,bench-press&sets=1,3&warmUpSets=2,0');
  expect(await screen.findByText('2 warm-ups · 1 set')).toBeTruthy();
  expect(screen.getByText('3 sets')).toBeTruthy();
  // Unknown template id still previews, titled "Workout".
  expect(screen.getByText('Workout')).toBeTruthy();
});

it('every card carries the 2:00 default rest badge', async () => {
  renderAtNow(routes, SL_A);
  await screen.findByText('Workout A');
  expect(screen.getAllByText('2:00 rest between sets')).toHaveLength(3);
});

it('Previous shows weight × reps from the stored snapshot and is omitted when there is none', async () => {
  await seed({ previous: { squat: { weightKg: 100, reps: 5 }, 'bench-press': { weightKg: 60 } } });
  renderAtNow(routes, SL_A);
  expect(await screen.findByText('Previous: 100 kg × 5')).toBeTruthy();
  expect(screen.getByText('Previous: 60 kg')).toBeTruthy();
  // barbell-row has no previous → no line at all (not "—").
  expect(screen.getAllByText(/^Previous:/)).toHaveLength(2);
  expect(screen.queryByText('—')).toBeNull();
});

it('Previous converts to pounds when the unit is lb', async () => {
  useSettingsStore.setState({ weightUnit: 'lb' });
  await seed({ previous: { squat: { weightKg: 100, reps: 3 } } });
  renderAtNow(routes, SL_A);
  expect(await screen.findByText('Previous: 220.5 lb × 3')).toBeTruthy();
});

it('Start workout replaces the route with /active-workout and the same plan', async () => {
  renderAtNow(routes, SL_A);
  fireEvent.press(await screen.findByText('Start workout'));
  expect(await screen.findByText('route:active-workout')).toBeTruthy();
  expect(searchParams()).toEqual({
    templateId: 'sl-a',
    exerciseIds: 'squat,bench-press,barbell-row',
    sets: '5,5,5',
  });
});

it('the header Start button does the same', async () => {
  setPro(true);
  renderAtNow(
    routes,
    '/workout-preview?templateId=tpl_x&exerciseIds=squat,bench-press&warmUpSets=1,0'
  );
  fireEvent.press(await screen.findByText('Start'));
  expect(await screen.findByText('route:active-workout')).toBeTruthy();
  expect(searchParams()).toEqual({
    templateId: 'tpl_x',
    exerciseIds: 'squat,bench-press',
    warmUpSets: '1,0',
  });
});
