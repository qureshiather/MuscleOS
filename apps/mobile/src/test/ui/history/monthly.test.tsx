import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import HistoryMonthlyScreen from '../../../../app/history-monthly';
import { resetAppState, routeStub } from '../render';
import { ex, finishedSession, renderAt, resetHistoryStores, restoreNow, seedSessions } from './helpers';

/** docs/features/history-analytics.md#monthly-calendar */

// Wednesday 16 Sep 2026, 12:00 local.
const NOW = new Date(2026, 8, 16, 12);

const routes = { 'history-monthly': HistoryMonthlyScreen };

beforeEach(async () => {
  await resetAppState();
  resetHistoryStores();
});

afterEach(restoreNow);

test('Monday-first grid for the current month with workout days marked', async () => {
  await seedSessions([
    finishedSession('a', new Date(2026, 8, 7, 23, 50), [ex('bench-press', [5, 60])]),
    finishedSession('b', new Date(2026, 8, 15, 9), [ex('squat', [5, 100])], 'ppl-legs'),
  ]);
  renderAt(NOW, routes, '/history-monthly');
  expect(await screen.findByText('September 2026')).toBeTruthy();

  const headers = screen.getAllByTestId('calendar-weekday').map((h) => within(h).getByText(/./).props.children);
  expect(headers).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);

  // 1 Sep 2026 is a Tuesday: one blank, then 1–6 on the first row.
  const rows = screen.getAllByTestId('calendar-row');
  expect(within(rows[0]).queryByText('1')).toBeTruthy();
  expect(within(rows[0]).queryByText('6')).toBeTruthy();
  expect(within(rows[0]).queryByText('7')).toBeNull();
  expect(within(rows[1]).getByText('7')).toBeTruthy();

  // Marked by local calendar date (23:50 on the 7th stays on the 7th).
  await waitFor(() =>
    expect(screen.getByTestId('calendar-day-2026-09-07').props.accessibilityHint).toBe('Has a workout')
  );
  expect(screen.getByTestId('calendar-day-2026-09-15').props.accessibilityHint).toBe('Has a workout');
  expect(screen.getByTestId('calendar-day-2026-09-08').props.accessibilityHint).toBeUndefined();
});

test('tapping a day toggles a detail card with template name and duration only', async () => {
  await seedSessions([
    finishedSession('a', new Date(2026, 8, 15, 9), [ex('squat', [5, 100])], 'ppl-legs', 45),
    finishedSession('b', new Date(2026, 8, 15, 18), [ex('plank', [1])], '_empty', 0.5),
  ]);
  renderAt(NOW, routes, '/history-monthly');
  await screen.findByText('September 2026');

  fireEvent.press(screen.getByTestId('calendar-day-2026-09-15'));
  expect(await screen.findByText('Tue, Sep 15')).toBeTruthy();
  expect(screen.getByText('Legs')).toBeTruthy();
  expect(screen.getByText('45m')).toBeTruthy();
  expect(screen.getByText('Empty workout')).toBeTruthy(); // sub-minute session: no duration
  expect(screen.queryByText('0m')).toBeNull();
  expect(screen.queryByText(/kg/)).toBeNull();

  fireEvent.press(screen.getByTestId('calendar-day-2026-09-15'));
  await waitFor(() => expect(screen.queryByText('Tue, Sep 15')).toBeNull());

  fireEvent.press(screen.getByTestId('calendar-day-2026-09-16'));
  expect(await screen.findByText('No workouts this day')).toBeTruthy();
});

test('month navigation is unbounded and clears the selection', async () => {
  renderAt(NOW, routes, '/history-monthly');
  await screen.findByText('September 2026');
  fireEvent.press(screen.getByTestId('calendar-day-2026-09-16'));
  await screen.findByText('No workouts this day');

  fireEvent.press(screen.getByLabelText('Next month'));
  expect(await screen.findByText('October 2026')).toBeTruthy();
  expect(screen.queryByText('No workouts this day')).toBeNull();
  // 1 Oct 2026 is a Thursday → three leading blanks.
  const firstRow = screen.getAllByTestId('calendar-row')[0];
  expect(within(firstRow).getByText('1')).toBeTruthy();
  expect(within(firstRow).getByText('4')).toBeTruthy();
  expect(within(firstRow).queryByText('5')).toBeNull();

  for (let i = 0; i < 10; i++) fireEvent.press(screen.getByLabelText('Previous month'));
  expect(await screen.findByText('December 2025')).toBeTruthy();
});
