/**
 * Workouts (home) tab — docs/features/templates.md#home-screen and #your-workouts. Real screen, real stores, seeded
 * through AsyncStorage; navigation targets are stubs.
 */
import { StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import HomeScreen from '../../../../app/(tabs)/index';
import TemplatesRedirect from '../../../../app/templates';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { defaultAppSettings, setAppSettings } from '@/storage/localStorage';
import { routeStub } from '../render';
import {
  DAY,
  NOW,
  completedSession,
  customTemplate,
  pathname,
  renderAtNow,
  searchParams,
  resetTemplatesTestState,
  seed,
  startActiveSession,
  storedTemplates,
} from './helpers';

jest.mock('@/sync', () => ({
  notifyTemplateUpsert: jest.fn(),
  notifyTemplateDelete: jest.fn(),
  notifyFolderUpsert: jest.fn(),
  notifyFolderDelete: jest.fn(),
  notifySessionUpsert: jest.fn(),
  notifySessionDelete: jest.fn(),
  notifyExercisePreviousSnapshot: jest.fn(),
  notifyCustomExerciseUpsert: jest.fn(),
  notifyCustomExerciseDelete: jest.fn(),
  syncAfterWorkout: jest.fn(),
}));

const routes = {
  '(tabs)/index': HomeScreen,
  'workout-preview': routeStub('workout-preview'),
  'active-workout': routeStub('active-workout'),
  'create-template': routeStub('create-template'),
  programs: routeStub('programs'),
  program: routeStub('program'),
};

function renderHome() {
  return renderAtNow(routes, '/');
}

/** Waits for the template list (not the skeleton) and for sessions, which load on focus. */
async function ready() {
  await waitFor(() => expect(useTemplatesStore.getState().isLoading).toBe(false));
  await screen.findByText('Your workouts');
  await waitFor(() => expect(useSessionsStore.getState().isLoading).toBe(false));
}

function expanded(label: string, index = 0): boolean | undefined {
  return screen.getAllByLabelText(label)[index].props.accessibilityState?.expanded;
}

function openMenu(name: string) {
  fireEvent.press(screen.getByLabelText(`Options for ${name}`));
}

beforeEach(async () => {
  await resetTemplatesTestState();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('sections', () => {
  it('renders the header, Suggested (max 2, from Your workouts), Recent (without Suggested picks), and Your workouts', async () => {
    await seed({
      activeProgramId: 'builtin_ul',
      sessions: [
        completedSession('ppl-push', NOW - 9 * DAY),
        completedSession('ppl-pull', NOW - 8 * DAY),
        completedSession('ppl-legs', NOW - 7 * DAY),
        completedSession('ul-upper-a', NOW - 6 * DAY),
        completedSession('ul-lower-a', NOW - 5 * DAY),
        completedSession('sl-a', NOW - 4 * DAY),
        completedSession('sl-b', NOW - 3 * DAY),
        completedSession('ul-upper-b', NOW - 2.5 * DAY),
      ],
    });
    renderHome();
    await ready();
    expect(screen.getByText('Workouts')).toBeTruthy();
    expect(screen.getByText('Suggested')).toBeTruthy();
    const suggested = screen.queryAllByTestId(/^suggested-card-/);
    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.length).toBeLessThanOrEqual(2);

    expect(screen.getByText('Recent')).toBeTruthy();
    const recent = screen.queryAllByTestId(/^recent-card-/);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(6);
    const suggestedIds = suggested.map((n) => n.props.testID.replace('suggested-card-', ''));
    // Only the chosen program's templates (there are no custom ones) can be suggested.
    for (const id of suggestedIds) expect(['ul-upper-a', 'ul-lower-a', 'ul-upper-b', 'ul-lower-b']).toContain(id);
    const recentIds = recent.map((n) => n.props.testID.replace('recent-card-', ''));
    for (const id of suggestedIds) expect(recentIds).not.toContain(id);
    // Only the chosen program's days: PPL and StrongLifts sessions are left out. Newest first.
    for (const id of recentIds) expect(['ul-upper-a', 'ul-lower-a', 'ul-upper-b']).toContain(id);
    expect(recentIds[0]).toBe(
      ['ul-upper-b', 'ul-lower-a', 'ul-upper-a'].find((id) => !suggestedIds.includes(id))
    );

    expect(screen.getByText('Upper Lower Splits')).toBeTruthy();
    expect(screen.queryByTestId('pick-a-program')).toBeNull();
  });

  it('with no program chosen, program days stay out of Recent', async () => {
    await seed({ sessions: [completedSession('ppl-push', NOW - 7 * DAY)] });
    renderHome();
    await ready();
    expect(screen.queryByTestId('recent-card-ppl-push')).toBeNull();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('hides Recent with no completed sessions', async () => {
    renderHome();
    await ready();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('starts with no program: no built-in is listed or suggested, and a Pick a program grid shows', async () => {
    await seed({ sessions: [completedSession('ppl-push', NOW - 9 * DAY)] });
    renderHome();
    await ready();
    expect(useSettingsStore.getState().activeProgramId).toBeNull();
    expect(screen.queryByText('Suggested')).toBeNull();
    expect(screen.queryByTestId('template-card-ppl-push')).toBeNull();
    for (const id of ['builtin_sl', 'builtin_ppl', 'builtin_ul', 'builtin_phul']) {
      expect(screen.getByTestId(`program-card-${id}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('program-card-builtin_phul'));
    expect(await screen.findByText('route:program')).toBeTruthy();
    expect(searchParams()).toEqual({ id: 'builtin_phul' });
  });

  it('with no program and no templates, Build a template opens create-template', async () => {
    renderHome();
    await ready();
    expect(screen.queryByTestId('templates-section-custom')).toBeNull();
    fireEvent.press(screen.getByLabelText('Build your own template'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
  });

  it('See all opens Programs', async () => {
    renderHome();
    await ready();
    fireEvent.press(screen.getByText('See all'));
    expect(await screen.findByText('route:programs')).toBeTruthy();
  });

  it('with templates but no program, only a quiet Browse programs link sits below My templates', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    expect(screen.queryByTestId('pick-a-program')).toBeNull();
    expect(screen.getByText('My templates')).toBeTruthy();
    expect(screen.getByText('Want a plan?', { exact: false })).toBeTruthy();
    expect(screen.queryByTestId('build-own-template-row')).toBeNull();
    fireEvent.press(screen.getByTestId('add-program-row'));
    expect(await screen.findByText('route:programs')).toBeTruthy();
  });

  it('the chosen program lists its templates (no menus) above My templates; Change opens Programs', async () => {
    await seed({
      activeProgramId: 'builtin_sl',
      templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })],
    });
    renderHome();
    await ready();
    const program = screen.getByTestId('your-workouts-program');
    expect(within(program).getByText('Strong Lifts 5x5')).toBeTruthy();
    expect(within(program).getByTestId('template-card-sl-a')).toBeTruthy();
    expect(within(program).getByTestId('template-card-sl-b')).toBeTruthy();
    expect(screen.queryByTestId('template-card-ppl-push')).toBeNull();
    expect(screen.queryByLabelText('Options for Workout A')).toBeNull();
    expect(screen.getByLabelText('Options for Chest day')).toBeTruthy();
    expect(screen.queryByTestId('add-program-row')).toBeNull();
    fireEvent.press(screen.getByLabelText('Change program'));
    expect(await screen.findByText('route:programs')).toBeTruthy();
  });

  it('the program section starts open and its chevron collapses and reopens it', async () => {
    await seed({ activeProgramId: 'builtin_sl' });
    renderHome();
    await ready();
    const toggle = () => screen.getByTestId('your-workouts-program-toggle');
    expect(toggle().props.accessibilityState?.expanded).toBe(true);
    fireEvent.press(toggle());
    expect(screen.queryByTestId('template-card-sl-a')).toBeNull();
    expect(screen.getByText('Strong Lifts 5x5')).toBeTruthy();
    expect(toggle().props.accessibilityState?.expanded).toBe(false);
    fireEvent.press(toggle());
    expect(screen.getByTestId('template-card-sl-a')).toBeTruthy();
  });

  it('tapping the program name opens its overview', async () => {
    await seed({ activeProgramId: 'builtin_sl' });
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('About Strong Lifts 5x5'));
    expect(await screen.findByText('route:program')).toBeTruthy();
    expect(searchParams()).toEqual({ id: 'builtin_sl' });
  });

  it('orders custom content: uncategorized → pinned → normal folders → Archived → Hidden; groups start closed', async () => {
    await seed({
      folders: [
        { id: 'f_normal', name: 'Normal folder' },
        { id: 'f_pinned', name: 'Pinned folder', favorite: true },
        { id: 'f_archived', name: 'Old folder', archived: true },
        { id: 'f_allhidden', name: 'Secret folder' },
        { id: 'f_empty', name: 'Empty folder' },
      ],
      templates: [
        customTemplate({ id: 'tpl_n', name: 'In normal', folderId: 'f_normal' }),
        customTemplate({ id: 'tpl_p', name: 'In pinned', folderId: 'f_pinned' }),
        customTemplate({ id: 'tpl_a', name: 'In archived', folderId: 'f_archived' }),
        customTemplate({ id: 'tpl_h', name: 'Hidden one', folderId: 'f_allhidden', hidden: true }),
        customTemplate({ id: 'tpl_u', name: 'Loose' }),
      ],
    });
    renderHome();
    await ready();
    const order = [
      'template-card-tpl_u',
      'Pinned folder',
      'Normal folder',
      'Empty folder',
      'Archived',
    ];
    const all = screen.UNSAFE_root.findAll(
      (n: { type: unknown; props: Record<string, string> }) =>
        typeof n.type !== 'string' &&
        (order.includes(n.props.testID) || order.includes(n.props.accessibilityLabel)) &&
        n.props.accessibilityRole === 'button'
    );
    const seen: string[] = [];
    for (const n of all) {
      const key = order.includes(n.props.testID) ? n.props.testID : n.props.accessibilityLabel;
      if (!seen.includes(key)) seen.push(key);
    }
    expect(seen).toEqual(order);
    // The folder whose only template is hidden is left out.
    expect(screen.queryByLabelText('Secret folder')).toBeNull();
    expect(screen.getByText('No templates in this folder.')).toBeTruthy();
    // Real folders open; Archived and Hidden closed.
    expect(expanded('Pinned folder')).toBe(true);
    expect(expanded('Archived')).toBe(false);
    expect(screen.queryByTestId('template-card-tpl_a')).toBeNull();
    expect(expanded('Hidden')).toBe(false);
    expect(screen.queryByTestId('template-card-tpl_h')).toBeNull();
    fireEvent.press(screen.getByLabelText('Archived'));
    expect(screen.getByTestId('template-card-tpl_a')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hidden'));
    expect(screen.getByTestId('template-card-tpl_h')).toBeTruthy();
  });

  it('a template card shows name, description, Last done, and exercise count', async () => {
    await seed({
      templates: [
        customTemplate({ id: 'tpl_x', name: 'Arms', description: 'Pump day', exerciseIds: ['barbell-curl', 'tricep-pushdown', 'hammer-curl'] }),
      ],
      sessions: [
        completedSession('tpl_x', NOW - 5 * DAY),
        completedSession('tpl_x', NOW - 2 * DAY),
      ],
    });
    renderHome();
    await ready();
    // Sessions load on focus, after the template list.
    await screen.findByText('Last done: 2 days ago');
    const card = screen.getByTestId('template-card-tpl_x');
    expect(within(card).getByText('Arms')).toBeTruthy();
    expect(within(card).getByText('Pump day')).toBeTruthy();
    expect(within(card).getByText('Last done: 2 days ago')).toBeTruthy();
    expect(within(card).getByText('3 exercises')).toBeTruthy();
  });

  it('the header headline comes from session history', async () => {
    await seed({ sessions: [completedSession('ppl-push', NOW - DAY)] });
    renderHome();
    expect(await screen.findByText('One this week.')).toBeTruthy();
  });

  it('the headline falls back to the prompt with no sessions', async () => {
    renderHome();
    await ready();
    expect(screen.getByText('Pick a template or start from scratch')).toBeTruthy();
  });

  it('shows no Last done line for a template never completed', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_new', name: 'Fresh' })] });
    renderHome();
    await ready();
    expect(within(screen.getByTestId('template-card-tpl_new')).queryByText(/Last done/)).toBeNull();
  });
});

describe('Your workouts states', () => {
  it('fresh user: Pick a program grid and Build a template, no program, My templates or Browse programs', async () => {
    renderHome();
    await ready();
    expect(screen.getByTestId('pick-a-program')).toBeTruthy();
    expect(screen.getByTestId('build-own-template-row')).toBeTruthy();
    expect(screen.queryByTestId('your-workouts-program')).toBeNull();
    expect(screen.queryByTestId('templates-section-custom')).toBeNull();
    expect(screen.queryByTestId('add-program-row')).toBeNull();
    expect(screen.queryByText('Suggested')).toBeNull();
  });

  it('program with no templates: the program, then Build a template; no grid or Browse programs', async () => {
    await seed({ activeProgramId: 'builtin_ppl' });
    renderHome();
    await ready();
    expect(within(screen.getByTestId('your-workouts-program')).getByText('Push Pull Legs')).toBeTruthy();
    expect(screen.getByTestId('template-card-ppl-push')).toBeTruthy();
    expect(screen.getByText('Suggested')).toBeTruthy();
    expect(screen.queryByTestId('pick-a-program')).toBeNull();
    expect(screen.queryByTestId('templates-section-custom')).toBeNull();
    expect(screen.queryByTestId('add-program-row')).toBeNull();
    fireEvent.press(screen.getByTestId('build-own-template-row'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
  });

  it('program with templates: the program, then My templates; no grid, Build a template or Browse programs', async () => {
    await seed({
      activeProgramId: 'builtin_ppl',
      templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })],
    });
    renderHome();
    await ready();
    expect(screen.getByTestId('your-workouts-program')).toBeTruthy();
    expect(within(screen.getByTestId('templates-section-custom')).getByText('Chest day')).toBeTruthy();
    expect(screen.queryByTestId('pick-a-program')).toBeNull();
    expect(screen.queryByTestId('build-own-template-row')).toBeNull();
    expect(screen.queryByTestId('add-program-row')).toBeNull();
  });
});

describe('theme switch', () => {
  // MUS-144: dropping borderWidth on these clipping sections left Android with a stale clip that
  // hid every template row after a light → dark switch. The border must stay in both themes.
  it('keeps the section border and its rows when switching light → dark', async () => {
    await seed({ activeProgramId: 'builtin_ppl', templates: [customTemplate({ id: 'c1', name: 'My Split' })] });
    renderHome();
    await ready();
    const borderWidths = () =>
      ['templates-section-custom', 'your-workouts-program'].map(
        (id) => StyleSheet.flatten(screen.getByTestId(id).props.style).borderWidth
      );
    expect(borderWidths()).toEqual([1, 1]);

    await act(() =>
      setAppSettings({ ...defaultAppSettings(), themePreference: 'dark', activeProgramId: 'builtin_ppl' })
    );

    // Dark hides the border by matching it to the fill rather than removing it.
    await waitFor(() => {
      const custom = StyleSheet.flatten(screen.getByTestId('templates-section-custom').props.style);
      expect(custom.borderColor).toBe(custom.backgroundColor);
    });
    expect(borderWidths()).toEqual([1, 1]);
    expect(screen.getByText('My Split')).toBeTruthy();
  });
});

describe('starting', () => {
  it('tapping a program template opens the preview with the template plan', async () => {
    await seed({ activeProgramId: 'builtin_sl' });
    renderHome();
    await ready();
    fireEvent.press(screen.getByTestId('template-card-sl-a'));
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(pathname()).toBe('/workout-preview');
    expect(searchParams()).toEqual({
      templateId: 'sl-a',
      exerciseIds: 'squat,bench-press,barbell-row',
      sets: '5,5,5',
    });
  });

  it('Empty workout skips the preview → /active-workout?templateId=_empty', async () => {
    renderHome();
    await ready();
    expect(screen.getByText('Add exercises as you go')).toBeTruthy();
    fireEvent.press(screen.getByText('Empty workout'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(searchParams()).toEqual({ templateId: '_empty', exerciseIds: '' });
  });

  it('a custom template card has no lock and opens the preview like a built-in', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    expect(screen.getByTestId('template-card-tpl_c').props.accessibilityLabel).toBe('Chest day, 2 exercises');
    fireEvent.press(screen.getByTestId('template-card-tpl_c'));
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(searchParams()).toMatchObject({ templateId: 'tpl_c' });
  });

  it('Suggested and Recent include custom templates', async () => {
    await seed({
      templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })],
      sessions: [completedSession('tpl_c', NOW - 3 * DAY)],
    });
    renderHome();
    await ready();
    expect(screen.getAllByLabelText(/^Chest day, /).length).toBeGreaterThan(1);
  });

  it('nothing on the Workouts tab mentions Pro, locks or upgrading', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    expect(screen.queryByText(/\bPro\b/)).toBeNull();
    expect(screen.queryByText(/Resubscribe|Upgrade|Included with/)).toBeNull();
  });

  it('with a session in progress, a card shows "Workout in progress"; Resume goes to the workout', async () => {
    startActiveSession();
    await seed({ activeProgramId: 'builtin_ppl' });
    renderHome();
    await ready();
    fireEvent.press(screen.getByTestId('template-card-ppl-pull'));
    expect(screen.getByText('Workout in progress')).toBeTruthy();
    expect(
      screen.getByText('Finish or cancel your current workout before starting another.')
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('resume-workout-confirm'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(searchParams()).toEqual({});
  });

  it('Cancel workout discards the session and continues to the tapped template', async () => {
    startActiveSession();
    await seed({ activeProgramId: 'builtin_ppl' });
    renderHome();
    await ready();
    fireEvent.press(screen.getByTestId('template-card-ppl-pull'));
    fireEvent.press(screen.getByTestId('resume-workout-cancel'));
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(useActiveWorkoutStore.getState().session).toBeNull();
    expect(searchParams()).toEqual(expect.objectContaining({ templateId: 'ppl-pull' }));
  });

  it('the empty-workout hero shows the same dialog when a session is in progress', async () => {
    startActiveSession();
    renderHome();
    await ready();
    fireEvent.press(screen.getByText('Empty workout'));
    expect(screen.getByText('Workout in progress')).toBeTruthy();
  });
});

describe('context menus', () => {
  it('hiding a custom moves it to Hidden (with a count) and out of Suggested; Unhide restores it', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-hide'));
    await waitFor(() => expect(useTemplatesStore.getState().userTemplates[0].hidden).toBe(true));
    expect(screen.queryByTestId('template-card-tpl_c')).toBeNull();
    expect(screen.queryByTestId('suggested-card-tpl_c')).toBeNull();
    expect(screen.getByText('Hidden (1)')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hidden'));
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-unhide'));
    await waitFor(() => expect(useTemplatesStore.getState().userTemplates[0].hidden).toBeUndefined());
  });

  it('a custom menu has Rename, Move, Edit, Hide, Delete', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    for (const k of ['rename', 'move', 'edit', 'hide', 'delete']) {
      expect(screen.getByTestId(`template-menu-${k}`)).toBeTruthy();
    }
  });

  it('Rename saves the trimmed name', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-rename'));
    expect(screen.getByText('Rename template')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('Chest day'), '  Push day  ');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(async () => expect((await storedTemplates())[0].name).toBe('Push day'));
  });

  it('Edit opens create-template in edit mode', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-edit'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
    expect(searchParams()).toEqual({ templateId: 'tpl_c' });
  });

  it('Move lists No folder, other folders, and New folder… → Create & move', async () => {
    await seed({
      folders: [
        { id: 'f_a', name: 'Folder A' },
        { id: 'f_b', name: 'Folder B' },
      ],
      templates: [customTemplate({ id: 'tpl_c', name: 'Chest day', folderId: 'f_a' })],
    });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-move'));
    expect(screen.getByText('Move "Chest day" to')).toBeTruthy();
    expect(screen.getByText('No folder')).toBeTruthy();
    // The current folder isn't offered as a destination.
    expect(screen.getAllByText('Folder A')).toHaveLength(1);
    fireEvent.press(screen.getByText('New folder…'));
    fireEvent.changeText(screen.getByPlaceholderText('Folder name'), 'Fresh');
    fireEvent.press(screen.getByText('Create & move'));
    await waitFor(() => {
      const { folders, userTemplates } = useTemplatesStore.getState();
      const fresh = folders.find((f) => f.name === 'Fresh');
      expect(fresh).toBeTruthy();
      expect(userTemplates[0].folderId).toBe(fresh?.id);
    });
  });

  it('Move → No folder clears the folder', async () => {
    await seed({
      folders: [{ id: 'f_a', name: 'Folder A' }],
      templates: [customTemplate({ id: 'tpl_c', name: 'Chest day', folderId: 'f_a' })],
    });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-move'));
    fireEvent.press(screen.getByText('No folder'));
    await waitFor(async () => expect((await storedTemplates())[0].folderId).toBeUndefined());
  });

  it('Move does not offer No folder for a template that has none', async () => {
    await seed({
      folders: [{ id: 'f_a', name: 'Folder A' }],
      templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })],
    });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-move'));
    expect(screen.getByText('Move "Chest day" to')).toBeTruthy();
    expect(screen.queryByText('No folder')).toBeNull();
    expect(screen.getAllByText('Folder A').length).toBeGreaterThan(0);
  });

  it('Delete asks a themed confirm; Cancel keeps, Delete removes', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-delete'));
    expect(screen.getByText('Delete "Chest day"? This cannot be undone.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('delete-template-keep'));
    expect(useTemplatesStore.getState().userTemplates).toHaveLength(1);
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-delete'));
    fireEvent.press(screen.getByTestId('delete-template-confirm'));
    await waitFor(async () => expect(await storedTemplates()).toEqual([]));
  });
});

describe('folders', () => {
  const folderSeed = {
    folders: [{ id: 'f_a', name: 'Folder A' }],
    templates: [
      customTemplate({ id: 'tpl_1', name: 'One', folderId: 'f_a' }),
      customTemplate({ id: 'tpl_2', name: 'Two', folderId: 'f_a', hidden: true }),
      customTemplate({ id: 'tpl_out', name: 'Outside' }),
    ],
  };

  it('custom folder menu: Rename, Pin to top, Archive, Delete', async () => {
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    for (const t of ['Rename', 'Pin to top', 'Archive', 'Delete']) expect(screen.getByText(t)).toBeTruthy();
    fireEvent.press(screen.getByText('Pin to top'));
    await waitFor(() => expect(useTemplatesStore.getState().folders[0].favorite).toBe(true));
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    expect(screen.getByText('Unpin from top')).toBeTruthy();
    fireEvent.press(screen.getByText('Archive'));
    await waitFor(() => expect(useTemplatesStore.getState().folders[0].archived).toBe(true));
    expect(screen.getByLabelText('Archived')).toBeTruthy();
  });

  it('delete prompt (themed) counts hidden templates; Keep templates keeps them', async () => {
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    fireEvent.press(screen.getByText('Delete'));
    expect(screen.getByText('Delete folder')).toBeTruthy();
    expect(
      screen.getByText('"Folder A" has 2 templates. Keep them outside the folder, or delete them too?')
    ).toBeTruthy();
    expect(screen.getByTestId('delete-folder-cancel')).toBeTruthy();
    expect(screen.getByText('Delete folder and templates')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-folder-keep-templates'));
    });
    await waitFor(async () => {
      const stored = await storedTemplates();
      expect(stored.map((t) => t.id)).toEqual(['tpl_1', 'tpl_2', 'tpl_out']);
      expect(stored.every((t) => t.folderId == null)).toBe(true);
    });
    expect(useTemplatesStore.getState().folders).toEqual([]);
  });

  it('Delete folder and templates also deletes hidden templates in it', async () => {
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    fireEvent.press(screen.getByText('Delete'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-folder-confirm'));
    });
    await waitFor(async () => expect((await storedTemplates()).map((t) => t.id)).toEqual(['tpl_out']));
    expect(useTemplatesStore.getState().folders).toEqual([]);
  });

  it('Cancel keeps the folder and its templates', async () => {
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    fireEvent.press(screen.getByText('Delete'));
    fireEvent.press(screen.getByTestId('delete-folder-cancel'));
    expect(screen.queryByText('Delete folder and templates')).toBeNull();
    expect(useTemplatesStore.getState().folders).toHaveLength(1);
  });

  it('an empty folder gets a plain Delete confirm', async () => {
    await seed({ folders: [{ id: 'f_e', name: 'Empty' }] });
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Empty'));
    fireEvent.press(screen.getByText('Delete'));
    expect(screen.getByText('Delete "Empty"?')).toBeTruthy();
    expect(screen.queryByTestId('delete-folder-keep-templates')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-folder-confirm'));
    });
    await waitFor(() => expect(useTemplatesStore.getState().folders).toEqual([]));
  });

  it('Rename folder saves the trimmed name', async () => {
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    fireEvent.press(screen.getByText('Rename'));
    expect(screen.getByText('Rename folder')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('Folder A'), ' Legs ');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(useTemplatesStore.getState().folders[0].name).toBe('Legs'));
  });
});

describe('redirects', () => {
  it('/templates replaces to the Workouts tab', async () => {
    renderAtNow({ ...routes, templates: TemplatesRedirect }, '/templates');
    await ready();
    expect(pathname()).toBe('/');
  });
});
