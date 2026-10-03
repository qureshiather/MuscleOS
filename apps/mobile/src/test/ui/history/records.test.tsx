import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import PersonalRecordsScreen from '../../../../app/personal-records';
import ExerciseProgressionScreen from '../../../../app/exercise-progression';
import { useSettingsStore } from '@/store/settingsStore';
import { resetAppState, routeStub, setPro } from '../render';
import { ex, finishedSession, renderAt, resetHistoryStores, restoreNow, seedSessions } from './helpers';

/**
 * docs/features/history-analytics.md#personal-records and #exercise-progression.
 */

const NOW = new Date(2026, 8, 16, 12);
const at = (day: number, hour = 10) => new Date(2026, 8, day, hour);

const routes = {
  'personal-records': PersonalRecordsScreen,
  'exercise-progression': ExerciseProgressionScreen,
  biodata: routeStub('biodata'),
  subscription: routeStub('subscription'),
};

// Squat best 100×5 → 116.7 kg; bench best 80×1 → 80; pull-up 20×5 → 23.3.
const SESSIONS = [
  finishedSession('s3', at(15), [ex('squat', [5, 100]), ex('bench-press', [1, 80])], 'ppl-legs'),
  finishedSession('s2', at(10), [ex('squat', [5, 90], [5, 95]), ex('pull-up', [5, 20])], 'ppl-legs'),
  finishedSession('s1', at(3), [ex('squat', [5, 80])], 'ppl-legs'),
];

beforeEach(async () => {
  await resetAppState();
  resetHistoryStores();
});

afterEach(restoreNow);

describe('Personal records', () => {
  test('Basic is redirected to the paywall', async () => {
    const { getSearchParams } = renderAt(NOW, routes, '/personal-records');
    await screen.findByText('route:subscription');
    expect(getSearchParams()).toEqual({ feature: 'personal_records' });
  });

  test('empty state', async () => {
    setPro(true);
    renderAt(NOW, routes, '/personal-records');
    expect(await screen.findByText('No records yet')).toBeTruthy();
  });

  test('lists exercises by best e1RM with 1-decimal e1RM and best set', async () => {
    setPro(true);
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/personal-records');
    await screen.findByText('116.7 kg');
    const e1rms = screen.getAllByText(/^\d+(\.\d)? kg$/).map((n) => n.props.children);
    expect(e1rms).toEqual(['116.7 kg', '80 kg', '23.3 kg']);
    expect(screen.getByText('100 kg × 5')).toBeTruthy();
  });

  test('progress bars: up to the 10 latest sets, only with 2+ sets', async () => {
    setPro(true);
    const many = Array.from({ length: 12 }, (_, i) =>
      finishedSession(`s${i}`, at(1 + i), [ex('squat', [5, 60 + i])], 'ppl-legs')
    );
    await seedSessions([...many, finishedSession('b', at(14), [ex('bench-press', [1, 80])])]);
    renderAt(NOW, routes, '/personal-records');
    await screen.findByText('80 kg');
    // Squat: 12 sets → 10 bars; bench: 1 set → no Progress section.
    expect(screen.getAllByTestId('pr-bar')).toHaveLength(10);
    expect(screen.getAllByText('Progress')).toHaveLength(1);
  });

  test('search filters by exercise name and reports no matches', async () => {
    setPro(true);
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/personal-records');
    await screen.findByText('116.7 kg');
    fireEvent.changeText(screen.getByLabelText('Search exercises'), 'bench');
    await waitFor(() => expect(screen.queryByText('116.7 kg')).toBeNull());
    expect(screen.getByText('80 kg')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search exercises'), 'zzzz');
    expect(await screen.findByText('No exercises match “zzzz”')).toBeTruthy();
  });

  test('without bodyweight and sex: Biodata hint, no strength chip', async () => {
    setPro(true);
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/personal-records');
    expect(await screen.findByText('Add weight & gender in Biodata for strength level comparison')).toBeTruthy();
    expect(screen.queryByText(/Intermediate|Novice|Untrained/)).toBeNull();
    fireEvent.press(screen.getByText('Add weight & gender in Biodata for strength level comparison'));
    expect(await screen.findByText('route:biodata')).toBeTruthy();
  });

  test('with a profile: strength chip with next-level target, never on pull-ups', async () => {
    setPro(true);
    useSettingsStore.setState({ profile: { weightKg: 80, sex: 'male' } });
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/personal-records');
    await screen.findByText('116.7 kg');
    expect(screen.queryByText(/Biodata/)).toBeNull();
    // Squat 116.7 / 80 = 1.46 → Novice, next Intermediate at 1.75 × 80 = 140.
    expect(screen.getByText('Novice → Intermediate @ 140 kg')).toBeTruthy();
    // Bench 80 / 80 = 1.0 → Novice, next Intermediate at 100.
    expect(screen.getByText('Novice → Intermediate @ 100 kg')).toBeTruthy();
    expect(screen.queryByText(/^Untrained/)).toBeNull(); // pull-up has no standards
  });

  test('tapping a card opens its progression', async () => {
    setPro(true);
    await seedSessions(SESSIONS);
    const { getPathname, getSearchParams } = renderAt(NOW, routes, '/personal-records');
    fireEvent.press(await screen.findByText('116.7 kg'));
    await screen.findByText('Progression & 1RM history');
    expect(getPathname()).toBe('/exercise-progression');
    expect(getSearchParams()).toEqual({ exerciseId: 'squat' });
  });
});

describe('Exercise progression', () => {
  test('Basic is redirected to the paywall', async () => {
    const { getSearchParams } = renderAt(NOW, routes, '/exercise-progression?exerciseId=squat');
    await screen.findByText('route:subscription');
    expect(getSearchParams()).toEqual({ feature: 'exercise_progression' });
  });

  test('one bar per qualifying set oldest→newest; sets listed newest first with ~e1RM', async () => {
    setPro(true);
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/exercise-progression?exerciseId=squat');
    expect(await screen.findByText('Progression & 1RM history')).toBeTruthy();
    expect(screen.getAllByText('116.7 kg').length).toBeGreaterThan(0);
    expect(screen.getByText('Best set: 100 kg × 5')).toBeTruthy();

    const bars = screen.getAllByTestId('progression-bar');
    expect(bars).toHaveLength(4); // two sets on Sep 10 → two adjacent bars
    const barLabels = bars.map((b) => b.props.accessibilityLabel);
    expect(barLabels).toEqual(['Sep 3, 93.3 kg', 'Sep 10, 105 kg', 'Sep 10, 110.8 kg', 'Sep 15, 116.7 kg']);
    // One date axis for the range rather than a clipped date under every bar.
    expect(screen.getByTestId('progression-axis-start').props.children).toBe('Sep 3');
    expect(screen.getByTestId('progression-axis-end').props.children).toBe('Sep 15');

    const rows = screen.getAllByTestId('progression-set');
    expect(rows).toHaveLength(4);
    expect(screen.getByText('~116.7 kg')).toBeTruthy();
    expect(screen.getByText('~93.3 kg')).toBeTruthy();
    expect(screen.getByText('~110.8 kg')).toBeTruthy();
  });

  test('strength level card with the profile; none without it or for pull-ups', async () => {
    setPro(true);
    useSettingsStore.setState({ profile: { weightKg: 80, sex: 'male' } });
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/exercise-progression?exerciseId=squat');
    expect(await screen.findByText('Strength level: Novice')).toBeTruthy();
    expect(screen.getByText('Next (Intermediate): 140 kg')).toBeTruthy();
  });

  test('no strength card for pull-ups', async () => {
    setPro(true);
    useSettingsStore.setState({ profile: { weightKg: 80, sex: 'male' } });
    await seedSessions(SESSIONS);
    renderAt(NOW, routes, '/exercise-progression?exerciseId=pull-up');
    expect(await screen.findByText('~23.3 kg')).toBeTruthy();
    expect(screen.queryByText(/Strength level/)).toBeNull();
  });

  test('an alias id resolves to the canonical exercise and merges its sets', async () => {
    setPro(true);
    await seedSessions([
      finishedSession('new', at(15), [ex('shrug', [10, 110])], 'ppl-pull'),
      finishedSession('old', at(9), [ex('barbell-shrug', [10, 100])], 'ppl-pull'),
    ]);
    renderAt(NOW, routes, '/exercise-progression?exerciseId=barbell-shrug');
    await screen.findByText('Progression & 1RM history');
    expect(screen.getAllByTestId('progression-set')).toHaveLength(2);
  });

  test('unknown exercise shows the empty message', async () => {
    setPro(true);
    renderAt(NOW, routes, '/exercise-progression?exerciseId=nope');
    expect(await screen.findByText('No progression data for this exercise.')).toBeTruthy();
  });
});
