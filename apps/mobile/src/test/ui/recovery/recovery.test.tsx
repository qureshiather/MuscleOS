import { type Href, router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import Body from 'react-native-body-highlighter';
import type { WorkoutSession } from '@muscleos/types';
import RecoveryScreen from '../../../../app/(tabs)/recovery';
import { setSessions } from '@/storage/localStorage';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { recoveryBucketsCopy } from '@/utils/recovery';
import { resetAppState, routeStub } from '../render';
import { renderAt, resetHistoryStores, restoreNow, setNow } from '../history/helpers';

/** docs/features/recovery.md#recovery-tab */

// Wednesday 16 Sep 2026, 10:00 local.
const NOW = new Date(2026, 8, 16, 10, 0, 0);
const HOUR = 60 * 60 * 1000;

const finished = (id: string, hoursAgo: number, exerciseId: string): WorkoutSession => {
  const completedAt = NOW.getTime() - hoursAgo * HOUR;
  return {
    id,
    templateId: 't',
    startedAt: new Date(completedAt - HOUR).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    exercises: [{ exerciseId, sets: [{ completed: true, reps: 5, weightKg: 60 }] }],
  };
};

async function renderRecovery(sessions: WorkoutSession[]) {
  await setSessions(sessions);
  renderAt(NOW, { recovery: RecoveryScreen }, '/recovery');
}

beforeEach(async () => {
  await resetAppState();
  resetHistoryStores();
});

afterEach(() => {
  restoreNow();
  jest.restoreAllMocks();
});

/** Highlighted regions → intensity. Parts painted with the neutral fill carry a colour instead. */
function bodyData() {
  const [front] = screen.UNSAFE_getAllByType(Body);
  return Object.fromEntries(
    (front.props.data as { slug: string; intensity?: number }[])
      .filter((d) => d.intensity != null)
      .map((d) => [d.slug, d.intensity])
  );
}

test('all clear: subtitle and every muscle green when nothing is recovering', async () => {
  await renderRecovery([finished('old', 100, 'bench-press')]);
  expect(await screen.findByText('All clear — every muscle group is ready')).toBeTruthy();
  expect(screen.queryByText('In recovery')).toBeNull();
  expect(screen.queryByText('Just trained')).toBeNull();
  expect(Object.keys(bodyData())).toHaveLength(15);
});

test('active: subtitle, legend, three-state diagram, and no Targeted label', async () => {
  await renderRecovery([finished('push', 1, 'bench-press'), finished('legs', 30, 'squat')]);
  expect(await screen.findByText('Muscles still recovering from recent training')).toBeTruthy();
  for (const label of ['Just trained', 'In recovery', 'Ready']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  const data = bodyData();
  expect(data.chest).toBe(1); // latest session = just trained
  expect(data.quadriceps).toBe(2); // earlier session, still recovering
  expect(data.biceps).toBe(3); // untouched = ready
  expect(screen.queryByText(/Targeted/)).toBeNull();
});

test('In recovery list: one row per muscle, insertion order, day-grain readiness copy', async () => {
  // Storage order: push (bench: chest, front delts, triceps) then legs 70 h ago (squat).
  await renderRecovery([finished('push', 1, 'bench-press'), finished('legs', 70, 'squat')]);
  await screen.findByText('Muscles still recovering from recent training');

  const names = screen
    .getAllByText(/^(Chest|Front Delts|Triceps|Quads|Glutes|Lower Back|Calves)$/)
    .map((n) => n.props.children as string);
  const ready = screen.getAllByText(/^Ready /).map((n) => n.props.children as string);
  expect(ready).toHaveLength(names.length);
  // Unsorted: bench muscles (first stored session) come before squat muscles.
  expect(names.slice(0, 3).sort()).toEqual(['Chest', 'Front Delts', 'Triceps']);
  expect(names.slice(3)).toContain('Quads');
  const readyFor = (muscle: string) => ready[names.indexOf(muscle)];
  // Finished 09:00 Wed: triceps +36 h → Thu 21:00, delts +48 h → Fri, chest +72 h → Sat.
  expect(readyFor('Triceps')).toBe('Ready tomorrow');
  expect(readyFor('Front Delts')).toBe('Ready Fri');
  expect(readyFor('Chest')).toBe('Ready Sat');
  // Squat 70 h ago: quads ready in 2 h, same calendar day.
  expect(readyFor('Quads')).toBe('Ready later today');
});

test('re-focusing drops muscles whose window has passed, without recomputing', async () => {
  await setSessions([finished('push', 1, 'bench-press')]);
  renderAt(NOW, { recovery: RecoveryScreen, other: routeStub('other') }, '/recovery');
  await screen.findByText('Triceps');
  const load = jest.spyOn(useRecoveryStore.getState(), 'load');

  // Leave, jump past the 36 h triceps window, come back.
  act(() => router.push('/other' as Href)); // a test-only route, absent from the generated typed routes
  await screen.findByText('route:other');
  setNow(NOW.getTime() + 36 * HOUR);
  act(() => router.back());

  expect(await screen.findByText('Chest')).toBeTruthy();
  expect(screen.queryByText('Triceps')).toBeNull();
  expect(load).not.toHaveBeenCalled();
});

test('shows the loading skeleton (no diagram) before the first load', async () => {
  // Keep the store "not loaded" with no load in flight: the skeleton stands in for the diagram.
  const { ensureLoaded } = useRecoveryStore.getState();
  useRecoveryStore.setState({ ensureLoaded: () => new Promise(() => {}) });
  try {
    await renderRecovery([]);
    expect(screen.getByText('Recovery')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(Body)).toHaveLength(0);
  } finally {
    // Unmount first: restoring the action re-runs the focus effect, which would load the store
    // outside act and leak updates into the next test.
    screen.unmount();
    useRecoveryStore.setState({ ensureLoaded });
  }
});

test('the help button opens the How recovery works explainer with copy from the constants', async () => {
  await renderRecovery([]);
  await screen.findByText('All clear — every muscle group is ready');
  fireEvent.press(screen.getByLabelText('How recovery works'));
  expect(await screen.findByText('Tracked per muscle group')).toBeTruthy();
  expect(screen.getByText(`Smaller muscles bounce back quicker. ${recoveryBucketsCopy()}`)).toBeTruthy();
  expect(screen.getByText(/Red is just trained, amber is still recovering/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close'));
  expect(screen.queryByText('Tracked per muscle group')).toBeNull();
});

test('uses the female figure when the profile says female', async () => {
  useSettingsStore.setState({ profile: { sex: 'female' } });
  await renderRecovery([]);
  await screen.findByText('All clear — every muscle group is ready');
  expect(screen.UNSAFE_getAllByType(Body)[0].props.gender).toBe('female');
});
