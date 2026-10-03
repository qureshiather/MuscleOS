/**
 * Workouts (home) tab — docs/features/templates.md#home-screen. Real screen, real stores, seeded
 * through AsyncStorage; navigation targets are stubs.
 */
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import HomeScreen from '../../../../app/(tabs)/index';
import TemplatesRedirect from '../../../../app/templates';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { routeStub, setPro } from '../render';
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
  subscription: routeStub('subscription'),
  'create-template': routeStub('create-template'),
};

function renderHome() {
  return renderAtNow(routes, '/');
}

/** Waits for the template list (not the skeleton) and for sessions, which load on focus. */
async function ready() {
  await screen.findByLabelText('Built-in');
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
  it('renders the header, Suggested (max 2), Recent (without Suggested picks), and both template sections', async () => {
    setPro(true);
    await seed({
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
    const recentIds = recent.map((n) => n.props.testID.replace('recent-card-', ''));
    for (const id of suggestedIds) expect(recentIds).not.toContain(id);
    // Newest first.
    expect(recentIds[0]).toBe(
      ['ul-upper-b', 'sl-b', 'sl-a'].find((id) => !suggestedIds.includes(id))
    );

    expect(screen.getByText('All templates')).toBeTruthy();
    expect(screen.getByLabelText('Custom')).toBeTruthy();
    expect(screen.getByLabelText('Built-in')).toBeTruthy();
  });

  it('hides Recent with no completed sessions', async () => {
    renderHome();
    await ready();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('Basic never sees custom templates in Suggested or Recent', async () => {
    await seed({
      templates: [customTemplate({ id: 'tpl_mine', name: 'Mine' })],
      sessions: [completedSession('tpl_mine', NOW - 3 * DAY)],
    });
    renderHome();
    await ready();
    expect(screen.queryByTestId('suggested-card-tpl_mine')).toBeNull();
    expect(screen.queryByTestId('recent-card-tpl_mine')).toBeNull();
  });

  it('Built-in starts collapsed; the first expand opens every subfolder', async () => {
    renderHome();
    await ready();
    expect(expanded('Built-in')).toBe(false);
    expect(screen.queryByLabelText('Push Pull Legs')).toBeNull();
    fireEvent.press(screen.getByLabelText('Built-in'));
    for (const folder of ['Push Pull Legs', 'Upper Lower Splits', 'Strong Lifts 5x5']) {
      expect(expanded(folder)).toBe(true);
    }
    expect(screen.getByTestId('template-card-ppl-push')).toBeTruthy();
    expect(screen.getByTestId('template-card-sl-b')).toBeTruthy();
  });

  it('Custom is hidden on Basic with no customs, and shows the empty state on Pro', async () => {
    renderHome();
    await ready();
    expect(screen.queryByLabelText('Custom')).toBeNull();
    // Basic still sees New / New folder; they open the paywall (covered in subscriptions/homeGates).
    expect(screen.getByLabelText('New template')).toBeTruthy();
  });

  it('Pro with no customs sees the Custom empty state, expanded by default', async () => {
    setPro(true);
    renderHome();
    await ready();
    expect(expanded('Custom')).toBe(true);
    expect(screen.getByText('No templates yet.')).toBeTruthy();
    fireEvent.press(screen.getByText('Create template'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
  });

  it('orders custom content: uncategorized → pinned → normal folders → Archived → Hidden; groups start closed', async () => {
    setPro(true);
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
    setPro(true);
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
    setPro(true);
    await seed({ templates: [customTemplate({ id: 'tpl_new', name: 'Fresh' })] });
    renderHome();
    await ready();
    expect(within(screen.getByTestId('template-card-tpl_new')).queryByText(/Last done/)).toBeNull();
  });
});

describe('lapsed Pro', () => {
  const notice = 'Your templates are saved. Resubscribe to Pro to run them.';

  it('Basic with custom templates sees them locked plus the notice, which opens the paywall', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_l', name: 'Locked one' })] });
    renderHome();
    await ready();
    expect(screen.getByLabelText('Locked one, 2 exercises, requires Pro')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(notice));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
  });

  it('the notice and Custom section also show when every custom template is hidden', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_h', name: 'Tucked', hidden: true })] });
    renderHome();
    await ready();
    expect(screen.getByLabelText('Custom')).toBeTruthy();
    expect(screen.getByLabelText(notice)).toBeTruthy();
  });

  it('Pro never sees the notice', async () => {
    setPro(true);
    await seed({ templates: [customTemplate({ id: 'tpl_l', name: 'Mine' })] });
    renderHome();
    await ready();
    expect(screen.queryByLabelText(notice)).toBeNull();
  });
});

describe('starting', () => {
  it('tapping a built-in opens the preview with the template plan', async () => {
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Built-in'));
    fireEvent.press(screen.getByTestId('template-card-sl-a'));
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(pathname()).toBe('/workout-preview');
    expect(searchParams()).toEqual({
      templateId: 'sl-a',
      exerciseIds: 'squat,bench-press,barbell-row',
      sets: '5,5,5',
    });
  });

  it('a locked custom card on Basic goes straight to the paywall, not the preview', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_l', name: 'Locked one' })] });
    renderHome();
    await ready();
    fireEvent.press(screen.getByTestId('template-card-tpl_l'));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(searchParams()).toEqual({ feature: 'custom_templates' });
  });

  it('Empty workout on Pro skips the preview → /active-workout?templateId=_empty', async () => {
    setPro(true);
    renderHome();
    await ready();
    expect(screen.getByText('Add exercises as you go')).toBeTruthy();
    fireEvent.press(screen.getByText('Empty workout'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(searchParams()).toEqual({ templateId: '_empty', exerciseIds: '' });
  });

  it('Empty workout on Basic reads "Included with Pro" and opens the paywall', async () => {
    renderHome();
    await ready();
    expect(screen.getByText('Included with Pro')).toBeTruthy();
    fireEvent.press(screen.getByText('Empty workout'));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(searchParams()).toEqual({ feature: 'empty_workout' });
  });

  it('with a session in progress, a card shows "Workout in progress"; Resume goes to the workout', async () => {
    startActiveSession();
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Built-in'));
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
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Built-in'));
    fireEvent.press(screen.getByTestId('template-card-ppl-pull'));
    fireEvent.press(screen.getByTestId('resume-workout-cancel'));
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(useActiveWorkoutStore.getState().session).toBeNull();
    expect(searchParams()).toEqual(expect.objectContaining({ templateId: 'ppl-pull' }));
  });

  it('the empty-workout hero shows the same dialog when a session is in progress', async () => {
    setPro(true);
    startActiveSession();
    renderHome();
    await ready();
    fireEvent.press(screen.getByText('Empty workout'));
    expect(screen.getByText('Workout in progress')).toBeTruthy();
  });
});

describe('context menus', () => {
  it('a built-in menu has only Hide; hiding moves it to the Built-in Hidden group', async () => {
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Built-in'));
    openMenu('Push');
    expect(screen.getByTestId('template-menu-hide')).toBeTruthy();
    for (const k of ['rename', 'move', 'edit', 'delete']) {
      expect(screen.queryByTestId(`template-menu-${k}`)).toBeNull();
    }
    fireEvent.press(screen.getByTestId('template-menu-hide'));
    await waitFor(() => expect(useTemplatesStore.getState().hiddenBuiltInIds).toEqual(['ppl-push']));
    expect(screen.queryByTestId('template-card-ppl-push')).toBeNull();
    fireEvent.press(screen.getByLabelText('Hidden'));
    expect(screen.getByTestId('template-card-ppl-push')).toBeTruthy();
    openMenu('Push');
    fireEvent.press(screen.getByTestId('template-menu-unhide'));
    await waitFor(() => expect(useTemplatesStore.getState().hiddenBuiltInIds).toEqual([]));
  });

  it('a template inside a hidden built-in folder offers Unhide folder, which restores the folder', async () => {
    await seed({ hiddenBuiltInFolderIds: ['builtin_sl'] });
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Built-in'));
    expect(screen.queryByLabelText('Strong Lifts 5x5')).toBeNull();
    fireEvent.press(screen.getByLabelText('Hidden'));
    openMenu('Workout A');
    expect(screen.queryByTestId('template-menu-unhide')).toBeNull();
    expect(screen.getByText('Unhide folder')).toBeTruthy();
    fireEvent.press(screen.getByTestId('template-menu-unhide-folder'));
    await waitFor(() => expect(useTemplatesStore.getState().hiddenBuiltInFolderIds).toEqual([]));
    expect(screen.queryByLabelText('Hidden')).toBeNull();
  });

  it('a built-in folder menu offers Hide, which hides every template in it', async () => {
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Built-in'));
    fireEvent.press(screen.getByLabelText('Options for Push Pull Legs'));
    expect(screen.queryByText('Rename')).toBeNull();
    fireEvent.press(screen.getByText('Hide'));
    await waitFor(() =>
      expect(useTemplatesStore.getState().hiddenBuiltInFolderIds).toEqual(['builtin_ppl'])
    );
    expect(screen.queryByTestId('template-card-ppl-push')).toBeNull();
  });

  it('a custom menu has Rename, Move, Edit, Hide, Delete', async () => {
    setPro(true);
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    for (const k of ['rename', 'move', 'edit', 'hide', 'delete']) {
      expect(screen.getByTestId(`template-menu-${k}`)).toBeTruthy();
    }
  });

  it('Rename saves the trimmed name', async () => {
    setPro(true);
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
    setPro(true);
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-edit'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
    expect(searchParams()).toEqual({ templateId: 'tpl_c' });
  });

  it('gated custom actions on Basic open the paywall; Hide and Delete still work', async () => {
    await seed({ templates: [customTemplate({ id: 'tpl_c', name: 'Chest day' })] });
    renderHome();
    await ready();
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-hide'));
    await waitFor(async () => expect((await storedTemplates())[0].hidden).toBe(true));
    fireEvent.press(screen.getByLabelText('Hidden'));
    openMenu('Chest day');
    fireEvent.press(screen.getByTestId('template-menu-rename'));
    expect(await screen.findByText('route:subscription')).toBeTruthy();
    expect(searchParams()).toEqual({ feature: 'custom_templates' });
  });

  it('Move lists No folder, other folders, and New folder… → Create & move', async () => {
    setPro(true);
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
    setPro(true);
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

  it('Delete asks a themed confirm; Cancel keeps, Delete removes', async () => {
    setPro(true);
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

  type AlertButtons = { text: string; onPress?: () => unknown }[];
  function lastAlert(spy: jest.SpyInstance) {
    const [title, message, buttons] = spy.mock.calls.at(-1) as [string, string, AlertButtons];
    // Alert handlers update the store and screen, so run them inside act.
    const press = (text: string) =>
      act(async () => {
        await buttons.find((b) => b.text === text)?.onPress?.();
      });
    return { title, message, buttons, press };
  }

  it('custom folder menu: Rename, Pin to top, Archive, Delete', async () => {
    setPro(true);
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

  it('delete prompt counts hidden templates; Remove from folder keeps them', async () => {
    setPro(true);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    fireEvent.press(screen.getByText('Delete'));
    const a = lastAlert(alert);
    expect(a.title).toBe('Delete folder');
    expect(a.message).toBe('"Folder A" has 2 templates. Remove them from the folder or delete them?');
    expect(a.buttons.map((b) => b.text)).toEqual(['Cancel', 'Remove from folder', 'Delete folder and templates']);
    await a.press('Remove from folder');
    await waitFor(async () => {
      const stored = await storedTemplates();
      expect(stored.map((t) => t.id)).toEqual(['tpl_1', 'tpl_2', 'tpl_out']);
      expect(stored.every((t) => t.folderId == null)).toBe(true);
    });
    expect(useTemplatesStore.getState().folders).toEqual([]);
  });

  it('Delete folder and templates also deletes hidden templates in it', async () => {
    setPro(true);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seed(folderSeed);
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Folder A'));
    fireEvent.press(screen.getByText('Delete'));
    await lastAlert(alert).press('Delete folder and templates');
    await waitFor(async () => expect((await storedTemplates()).map((t) => t.id)).toEqual(['tpl_out']));
    expect(useTemplatesStore.getState().folders).toEqual([]);
  });

  it('an empty folder gets a plain Delete confirm', async () => {
    setPro(true);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seed({ folders: [{ id: 'f_e', name: 'Empty' }] });
    renderHome();
    await ready();
    fireEvent.press(screen.getByLabelText('Options for Empty'));
    fireEvent.press(screen.getByText('Delete'));
    const a = lastAlert(alert);
    expect(a.message).toBe('Delete "Empty"?');
    expect(a.buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    await a.press('Delete');
    await waitFor(() => expect(useTemplatesStore.getState().folders).toEqual([]));
  });

  it('Rename folder saves the trimmed name', async () => {
    setPro(true);
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
