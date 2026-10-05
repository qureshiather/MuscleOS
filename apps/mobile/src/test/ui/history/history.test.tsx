import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import HistoryScreen from '../../../../app/(tabs)/history';
import { getSessions } from '@/storage/localStorage';
import { useAuthStore } from '@/store/authStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resetAppState, routeStub } from '../render';
import { ex, finishedSession, renderAt, resetHistoryStores, restoreNow, seedSessions } from './helpers';

/** docs/features/history-analytics.md#history-list */

jest.mock('@/sync', () => ({
  ...jest.requireActual('@/sync'),
  syncNow: jest.fn(async () => undefined),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
}));
const sync = jest.requireMock('@/sync') as { syncNow: jest.Mock; notifySessionDelete: jest.Mock };

// Wednesday 16 Sep 2026, 12:00 local.
const NOW = new Date(2026, 8, 16, 12);
const at = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour);

/** Two sessions this week (one empty workout), one last week, one in the week of Aug 31. */
const SESSIONS = [
  finishedSession('push-new', at(9, 15), [ex('bench-press', [8, 70], [8, 70], [8, 70])], 'ppl-push'),
  finishedSession('empty', at(9, 14), [ex('plank', [1])], '_empty', 20),
  finishedSession('push-old', at(9, 9), [ex('bench-press', [8, 60], [8, 60], [8, 60])], 'ppl-push'),
  finishedSession('legs', at(9, 1), [ex('squat', [5, 100])], 'ppl-legs', 45),
];

const routes = {
  '(tabs)/history': HistoryScreen,
  'personal-records': routeStub('personal-records'),
  'history-monthly': routeStub('history-monthly'),
};

async function renderHistory() {
  const result = renderAt(NOW, routes, '/history');
  await screen.findByText('History');
  return result;
}

beforeEach(async () => {
  await resetAppState();
  resetHistoryStores();
  useAuthStore.setState({ isAnonymous: true });
  jest.clearAllMocks();
});

afterEach(restoreNow);

test('week headers: labels, newest week first, singular "1 session" and compact volume', async () => {
  await seedSessions(SESSIONS);
  await renderHistory();
  expect(await screen.findByText('This week')).toBeTruthy();
  const labels = screen.getAllByText(/^(This week|Last week|Week of .+)$/).map((n) => n.props.children);
  expect(labels).toEqual(['This week', 'Last week', 'Week of Aug 31']);
  expect(screen.getByText('2 sessions · 1,680 kg')).toBeTruthy();
  expect(screen.getByText('1 session · 1,440 kg')).toBeTruthy();
  expect(screen.getByText('1 session · 500 kg')).toBeTruthy();
});

test('session cards: names (incl. Empty workout), date, stats line and volume change', async () => {
  await seedSessions(SESSIONS);
  await renderHistory();
  await screen.findByText('This week');
  expect(screen.getAllByText('Push')).toHaveLength(2);
  expect(screen.getByText('Empty workout')).toBeTruthy();
  expect(screen.getByText('Legs')).toBeTruthy();
  expect(screen.getByText('Tue, Sep 15')).toBeTruthy();
  // 1,680 vs 1,440 kg on the previous Push → ↑17%; first Push has no change.
  expect(screen.getByText('59m · 1,680 kg ↑17%')).toBeTruthy();
  expect(screen.getByText('59m · 1,440 kg')).toBeTruthy();
  // Empty workouts get no volume change; bodyweight-only volume is dropped.
  expect(screen.getByText('20m')).toBeTruthy();
  expect(screen.getAllByText(/^1 exercise · 3 sets/)).toHaveLength(2);
});

test('the newest card starts expanded; tapping toggles any card', async () => {
  await seedSessions(SESSIONS);
  await renderHistory();
  expect(await screen.findByText('3 × 8 @ 70 kg')).toBeTruthy();
  expect(screen.queryByText('3 × 8 @ 60 kg')).toBeNull();

  fireEvent.press(screen.getByText('59m · 1,440 kg'));
  expect(await screen.findByText('3 × 8 @ 60 kg')).toBeTruthy();

  fireEvent.press(screen.getByText('59m · 1,680 kg ↑17%'));
  await waitFor(() => expect(screen.queryByText('3 × 8 @ 70 kg')).toBeNull());
});

test('PR badges and counts show on session cards', async () => {
  await seedSessions(SESSIONS);
  await renderHistory();
  expect(await screen.findByText('1 exercise · 3 sets · 1 PR')).toBeTruthy();
  expect(screen.getByText('PR')).toBeTruthy();
});

test('an alias-logged lift still counts toward PRs against its canonical exercise', async () => {
  await seedSessions([
    finishedSession('new', at(9, 15), [ex('shrug', [10, 110])], 'ppl-pull'),
    finishedSession('old', at(9, 9), [ex('barbell-shrug', [10, 100])], 'ppl-pull'),
  ]);
  await renderHistory();
  expect(await screen.findByText('1 exercise · 1 set · 1 PR')).toBeTruthy();
});

test('header shortcuts open Personal Records and the calendar', async () => {
  const { getPathname } = await renderHistory();
  fireEvent.press(screen.getByLabelText('Monthly calendar'));
  await screen.findByText('route:history-monthly');
  expect(getPathname()).toBe('/history-monthly');
  act(() => require('expo-router').router.back());
  fireEvent.press(await screen.findByLabelText('Personal records'));
  await screen.findByText('route:personal-records');
  expect(getPathname()).toBe('/personal-records');
});

test('deleting a session: confirm dialog, removed from history and storage, recovery recomputed', async () => {
  await seedSessions(SESSIONS);
  await act(() => useRecoveryStore.getState().load());
  await renderHistory();
  await screen.findByText('Legs');

  fireEvent.press(screen.getByLabelText('Delete Legs'));
  expect(await screen.findByText('Delete workout')).toBeTruthy();
  expect(
    screen.getByText('Removes this session from history and its recovery impact. This cannot be undone.')
  ).toBeTruthy();

  fireEvent.press(screen.getByTestId('delete-session-keep'));
  await waitFor(() => expect(screen.queryByText('Delete workout')).toBeNull());
  expect(screen.getByText('Legs')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Delete Legs'));
  fireEvent.press(await screen.findByTestId('delete-session-confirm'));
  await waitFor(() => expect(screen.queryByText('Legs')).toBeNull());
  expect((await getSessions()).map((s) => s.id)).not.toContain('legs');
  expect(useRecoveryStore.getState().items.map((r) => r.muscleId)).not.toContain('quads');
  expect(sync.notifySessionDelete).toHaveBeenCalledWith('legs');
});

test('empty state copy', async () => {
  await renderHistory();
  expect(await screen.findByText('No sessions yet')).toBeTruthy();
  expect(screen.getByText('Finish a workout and it will show up here with duration, volume, and sets.')).toBeTruthy();
});

test('pull to refresh works from the empty state and reloads sessions', async () => {
  await renderHistory();
  await screen.findByText('No sessions yet');
  await seedSessions([SESSIONS[0]]);
  const scroll = screen.getByTestId('history-scroll');
  await act(() => scroll.props.refreshControl.props.onRefresh());
  expect(await screen.findByText('Tue, Sep 15')).toBeTruthy();
  expect(sync.syncNow).not.toHaveBeenCalled(); // guest: local reload only
});

test('with a linked account, pull to refresh syncs first', async () => {
  useAuthStore.setState({ isAnonymous: false });
  await renderHistory();
  await screen.findByText('No sessions yet');
  const scroll = screen.getByTestId('history-scroll');
  await act(() => scroll.props.refreshControl.props.onRefresh());
  expect(sync.syncNow).toHaveBeenCalledTimes(1);
});

test('volume and set weights follow the pounds setting', async () => {
  useSettingsStore.setState({ weightUnit: 'lb' });
  await seedSessions([SESSIONS[0]]);
  await renderHistory();
  expect(await screen.findByText('3 × 8 @ 154.3 lb')).toBeTruthy();
  expect(screen.getByText('59m · 3,704 lb')).toBeTruthy();
});
