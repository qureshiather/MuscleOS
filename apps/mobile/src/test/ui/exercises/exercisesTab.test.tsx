import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { useExercisesStore } from '@/store/exercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { resetAppState } from '../render';
import { exercise, renderExercises, seedExercises } from './helpers';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const { openBrowserAsync } = jest.requireMock('expo-web-browser') as { openBrowserAsync: jest.Mock };

jest.mock('@/sync', () => ({
  notifyCustomExerciseUpsert: jest.fn(),
  notifyCustomExerciseDelete: jest.fn(),
  notifyExerciseNotesSnapshot: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
}));
jest.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: jest.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));

const SEARCH = 'Search by name, muscle, equipment...';
const CUSTOM = exercise('custom_1', 'Landmine Press', {
  muscles: ['front_delts'],
  equipment: [],
  category: 'free_weight',
});

beforeEach(async () => {
  await resetAppState();
  seedExercises([CUSTOM]);
});

function names(): string[] {
  return ['Bench Press', 'Back Squat', 'Lat Pulldown', 'Pec Deck', 'Push-Up', 'Landmine Press'].filter(
    (n) => screen.queryByText(n) !== null
  );
}

async function openFilters() {
  fireEvent.press(screen.getByText('Filters'));
  await screen.findByTestId('type-chip-all');
}

describe('Exercises tab list', () => {
  it('shows the movement count (published + customs) and the list count line', async () => {
    renderExercises();
    expect(await screen.findByText('6 movements · tap for muscle map')).toBeTruthy();
    expect(screen.getByText('6 exercises')).toBeTruthy();
    // Unpublished catalog rows are hidden from browsing.
    expect(screen.queryByText('Stationary Bike')).toBeNull();
  });

  it('lists catalog order then customs, with a Custom badge and muscle / type lines', async () => {
    renderExercises();
    await screen.findByText('Bench Press');
    expect(names()).toEqual([
      'Bench Press',
      'Back Squat',
      'Lat Pulldown',
      'Pec Deck',
      'Push-Up',
      'Landmine Press',
    ]);
    expect(screen.getAllByText('Custom')).toHaveLength(1);
    expect(screen.getByText('Lats · Biceps')).toBeTruthy();
    expect(screen.getByText('Cable')).toBeTruthy();
    // Customs with no equipment show only the type.
    expect(screen.getAllByText('Free Weight').length).toBeGreaterThan(0);
  });

  it('uses the singular count for one result', async () => {
    renderExercises();
    fireEvent.changeText(await screen.findByPlaceholderText(SEARCH), 'pulldown');
    expect(await screen.findByText('1 exercise')).toBeTruthy();
  });
});

describe('search and filters', () => {
  it('filters and ranks by the search query', async () => {
    renderExercises();
    fireEvent.changeText(await screen.findByPlaceholderText(SEARCH), 'press');
    await waitFor(() => expect(names()).toEqual(['Bench Press', 'Landmine Press']));
  });

  it('summarises collapsed filters as "<Type> · <Muscle>"', async () => {
    renderExercises();
    expect(await screen.findByText('All · All')).toBeTruthy();
    await openFilters();
    fireEvent.press(screen.getByTestId('type-chip-cable'));
    fireEvent.press(screen.getByTestId('muscle-chip-back'));
    fireEvent.press(screen.getByText('Filters'));
    expect(await screen.findByText('Cable · Back')).toBeTruthy();
  });

  it('filters by Type, and tapping the active chip clears it', async () => {
    renderExercises();
    await openFilters();
    fireEvent.press(screen.getByTestId('type-chip-machine'));
    await waitFor(() => expect(names()).toEqual(['Pec Deck']));
    fireEvent.press(screen.getByTestId('type-chip-machine'));
    await waitFor(() => expect(names()).toHaveLength(6));
  });

  it('filters by a coarse muscle group and an individual muscle', async () => {
    renderExercises();
    await openFilters();
    fireEvent.press(screen.getByTestId('muscle-chip-legs'));
    await waitFor(() => expect(names()).toEqual(['Back Squat']));
    fireEvent.press(screen.getByTestId('muscle-chip-triceps'));
    await waitFor(() => expect(names()).toEqual(['Bench Press', 'Push-Up']));
    fireEvent.press(screen.getByTestId('muscle-chip-all'));
    await waitFor(() => expect(names()).toHaveLength(6));
  });

  it('offers a single Chest chip (no coarse chest group) plus Legs, Back, Shoulders', async () => {
    renderExercises();
    await openFilters();
    expect(screen.queryByTestId('muscle-chip-chest')).toBeTruthy();
    for (const key of ['legs', 'back', 'shoulders']) {
      expect(screen.getByTestId(`muscle-chip-${key}`)).toBeTruthy();
    }
    const chestChips = screen
      .getAllByText('Chest')
      .filter((node) => within(screen.getByTestId('muscle-chip-chest')).queryByText('Chest') === node);
    expect(chestChips).toHaveLength(1);
    expect(screen.getAllByTestId(/^muscle-chip-/)).toHaveLength(1 + 3 + 18);
  });

  it('ANDs the query with Type and Muscle filters', async () => {
    renderExercises();
    await openFilters();
    fireEvent.press(screen.getByTestId('type-chip-bodyweight'));
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH), 'press');
    expect(await screen.findByText('Create “press”')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH), 'push');
    await waitFor(() => expect(names()).toEqual(['Push-Up']));
  });
});

describe('empty states', () => {
  it('shows the no-match copy when filters exclude everything and there is no query', async () => {
    seedExercises([], [exercise('bench-press', 'Bench Press')]);
    renderExercises();
    await openFilters();
    fireEvent.press(screen.getByTestId('type-chip-cable'));
    expect(await screen.findByText('No exercises match these filters.')).toBeTruthy();
    expect(screen.getByText('0 exercises')).toBeTruthy();
  });

  it('the Create "<query>" row opens the create form prefilled with the query', async () => {
    const { getPathname } = renderExercises();
    fireEvent.changeText(await screen.findByPlaceholderText(SEARCH), 'Zercher Carry');
    expect(await screen.findByText('Save it as your own exercise.')).toBeTruthy();
    fireEvent.press(screen.getByText('Create “Zercher Carry”'));
    await waitFor(() => expect(getPathname()).toBe('/create-exercise'));
    expect(await screen.findByDisplayValue('Zercher Carry')).toBeTruthy();
    expect(screen.getByText('New exercise')).toBeTruthy();
  });
});

describe('header + button', () => {
  it('opens the create form', async () => {
    const { getPathname } = renderExercises();
    fireEvent.press(await screen.findByLabelText('Create exercise'));
    await waitFor(() => expect(getPathname()).toBe('/create-exercise'));
  });
});

describe('detail sheet', () => {
  it('shows muscles, type, instructions and notes; no Edit/Delete for catalog rows', async () => {
    renderExercises();
    fireEvent.press(await screen.findByText('Bench Press'));
    expect(await screen.findByText('Lower the bar to your chest and press.')).toBeTruthy();
    expect(screen.getByText('Chest, Triceps')).toBeTruthy();
    // Bench Press and Back Squat rows, plus the sheet.
    expect(screen.getAllByText('Free Weight · Barbell').length).toBe(3);
    expect(screen.getByText('Your notes')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('saves a trimmed note on Close, keyed by exercise id', async () => {
    renderExercises();
    fireEvent.press(await screen.findByText('Pec Deck'));
    fireEvent.changeText(
      await screen.findByPlaceholderText('e.g. seat 4 · lever underneath on 3'),
      '  seat 4  '
    );
    fireEvent.press(screen.getByText('Close'));
    await waitFor(() => expect(useExerciseNotesStore.getState().notes).toEqual({ 'pec-deck': 'seat 4' }));
  });

  it('saves on end-editing and on backdrop tap, and reopens with the saved note', async () => {
    renderExercises();
    fireEvent.press(await screen.findByText('Pec Deck'));
    const input = await screen.findByPlaceholderText('e.g. seat 4 · lever underneath on 3');
    fireEvent.changeText(input, 'lever 3');
    fireEvent(input, 'endEditing');
    await waitFor(() => expect(useExerciseNotesStore.getState().notes['pec-deck']).toBe('lever 3'));

    fireEvent.changeText(input, 'lever 5');
    fireEvent.press(screen.getByLabelText('Dismiss exercise details'));
    await waitFor(() => expect(useExerciseNotesStore.getState().notes['pec-deck']).toBe('lever 5'));

    fireEvent.press(screen.getByText('Pec Deck'));
    expect(await screen.findByDisplayValue('lever 5')).toBeTruthy();
  });

  it('Save stores the note without closing the sheet, then shows Saved', async () => {
    renderExercises();
    fireEvent.press(await screen.findByText('Pec Deck'));
    expect(screen.queryByTestId('exercise-note-save')).toBeNull();
    fireEvent.changeText(await screen.findByPlaceholderText('e.g. seat 4 · lever underneath on 3'), 'seat 4 ');
    fireEvent.press(screen.getByTestId('exercise-note-save'));
    await waitFor(() => expect(useExerciseNotesStore.getState().notes).toEqual({ 'pec-deck': 'seat 4' }));
    expect(screen.queryByTestId('exercise-note-save')).toBeNull();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Your notes')).toBeTruthy();
  });

  it('links catalog exercises to their website page, customs to nothing', async () => {
    renderExercises();
    fireEvent.press(await screen.findByText('Pec Deck'));
    fireEvent.press(await screen.findByTestId('exercise-detail-demo'));
    expect(openBrowserAsync).toHaveBeenCalledWith('https://muscleos.app/exercises/pec-deck');
    fireEvent.press(screen.getByText('Close'));

    fireEvent.press(await screen.findByText('Landmine Press'));
    await screen.findByText('Your notes');
    expect(screen.queryByTestId('exercise-detail-demo')).toBeNull();
  });

  it('links to the exercise history only once it has logged sets', async () => {
    const { getPathname } = renderExercises();
    fireEvent.press(await screen.findByText('Bench Press'));
    expect(screen.queryByTestId('exercise-detail-history')).toBeNull();
    fireEvent.press(screen.getByText('Close'));

    act(() => {
      useSessionsStore.setState({
        sessions: [
          {
            id: 's1',
            templateId: 'push',
            startedAt: '2026-01-01T10:00:00.000Z',
            completedAt: '2026-01-01T11:00:00.000Z',
            exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
          },
        ],
      });
    });
    fireEvent.press(await screen.findByText('Bench Press'));
    fireEvent.press(await screen.findByTestId('exercise-detail-history'));
    await waitFor(() => expect(getPathname()).toBe('/exercise-progression'));
  });

  it('clearing a note deletes it', async () => {
    useExerciseNotesStore.setState({ notes: { 'pec-deck': 'seat 4' }, isLoading: false });
    renderExercises();
    fireEvent.press(await screen.findByText('Pec Deck'));
    fireEvent.changeText(await screen.findByDisplayValue('seat 4'), '   ');
    fireEvent.press(screen.getByText('Close'));
    await waitFor(() => expect(useExerciseNotesStore.getState().notes).toEqual({}));
  });

  it('Edit on a custom opens the prefilled edit form', async () => {
    const { getPathname, getSearchParams } = renderExercises();
    fireEvent.press(await screen.findByText('Landmine Press'));
    fireEvent.press(await screen.findByText('Edit'));
    await waitFor(() => expect(getPathname()).toBe('/create-exercise'));
    expect(getSearchParams()).toMatchObject({ id: 'custom_1' });
    expect(await screen.findByText('Edit exercise')).toBeTruthy();
    expect(screen.getByDisplayValue('Landmine Press')).toBeTruthy();
  });

  it('Delete removes the custom after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    renderExercises();
    fireEvent.press(await screen.findByText('Landmine Press'));
    fireEvent.press(await screen.findByText('Delete'));

    expect(alert).toHaveBeenCalledWith(
      'Delete exercise',
      'Remove Landmine Press from your account? Past workouts keep the name if you logged it.',
      expect.any(Array)
    );
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    await act(async () => {
      buttons[1].onPress?.();
    });
    await waitFor(() => expect(useExercisesStore.getState().customExercises).toEqual([]));
    expect(screen.queryByText('Landmine Press')).toBeNull();
    alert.mockRestore();
  });

  it('cancelling the delete keeps the custom', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    renderExercises();
    fireEvent.press(await screen.findByText('Landmine Press'));
    fireEvent.press(await screen.findByText('Delete'));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons[0].onPress?.();
    expect(useExercisesStore.getState().customExercises).toHaveLength(1);
    alert.mockRestore();
  });
});
