/**
 * Create / edit template — docs/features/templates.md#creating-and-editing.
 */
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { type Href, router } from 'expo-router';
import CreateTemplateScreen from '../../../../app/create-template';
import { useTemplatesStore } from '@/store/templatesStore';
import { routeStub } from '../render';
import {
  customTemplate,
  renderAtNow,
  resetTemplatesTestState,
  searchParams,
  seed,
  storedTemplates,
} from './helpers';

jest.mock('@/sync', () => ({
  notifyTemplateUpsert: jest.fn(),
  notifyTemplateDelete: jest.fn(),
  notifyFolderUpsert: jest.fn(),
  notifyFolderDelete: jest.fn(),
}));

const routes = {
  index: routeStub('home'),
  'create-template': CreateTemplateScreen,
  'create-exercise': routeStub('create-exercise'),
};

/** Opens the screen from a home stub so `router.back()` after saving has somewhere to go. */
async function open(params = '') {
  renderAtNow(routes, '/');
  await screen.findByText('route:home');
  act(() => router.push(`/create-template${params}` as Href));
}

async function addExercise(name: string) {
  fireEvent.press(screen.getByText('Add exercises'));
  fireEvent.changeText(screen.getByPlaceholderText('Search...'), name);
  fireEvent.press(await screen.findByText(name));
  fireEvent.press(screen.getByText('Done'));
}

beforeEach(async () => {
  await resetTemplatesTestState();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('gate', () => {
});

describe('create', () => {
  it('shows the new-template form with the empty exercise state', async () => {
    await open();
    expect(await screen.findByText('New template')).toBeTruthy();
    expect(screen.getByText('Template name')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. Push A')).toBeTruthy();
    expect(screen.getByText('Exercises · 0')).toBeTruthy();
    expect(screen.getByText('No exercises yet')).toBeTruthy();
    expect(screen.getByText('Save template')).toBeTruthy();
    // No folders → no folder chips.
    expect(screen.queryByText('Folder')).toBeNull();
  });

  it('validates name and exercises on save and saves nothing', async () => {
    await open();
    await screen.findByText('New template');
    fireEvent.press(screen.getByText('Save template'));
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Add at least one exercise')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Push A'), '   ');
    fireEvent.press(screen.getByText('Save template'));
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(await storedTemplates()).toEqual([]);
  });

  it('adds an exercise at 3 sets / 0 warm-ups; the picker hides already-added exercises', async () => {
    await open();
    await screen.findByText('New template');
    await addExercise('Bench Press');
    expect(screen.getByText('Exercises · 1')).toBeTruthy();
    expect(screen.getByLabelText('3 Sets')).toBeTruthy();
    expect(screen.getByLabelText('0 Warm-up')).toBeTruthy();
    // One exercise: no reorder hint.
    expect(screen.queryByText('Hold and drag to rearrange')).toBeNull();
    // Muscles used appears once exercises resolve.
    expect(screen.getByText('Muscles used')).toBeTruthy();

    fireEvent.press(screen.getByText('Add exercises'));
    fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'Bench Press');
    expect(screen.queryAllByText('Bench Press')).toHaveLength(1); // only the selected row
    fireEvent.press(screen.getByText('Done'));
  });

  it('offers Create "<query>" when the search has no match', async () => {
    await open();
    await screen.findByText('New template');
    fireEvent.press(screen.getByText('Add exercises'));
    expect(screen.getByText('Add exercise')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'Zzqx Lift');
    expect(await screen.findByText('Create “Zzqx Lift”')).toBeTruthy();
  });

  it('steppers: sets stop at 1, warm-ups at 0, no maximum', async () => {
    await open();
    await screen.findByText('New template');
    await addExercise('Bench Press');
    for (let i = 0; i < 5; i += 1) fireEvent.press(screen.getByLabelText('Decrease Sets'));
    expect(screen.getByLabelText('1 Sets')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Decrease Warm-up'));
    expect(screen.getByLabelText('0 Warm-up')).toBeTruthy();
    for (let i = 0; i < 12; i += 1) fireEvent.press(screen.getByLabelText('Increase Sets'));
    expect(screen.getByLabelText('13 Sets')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Increase Warm-up'));
    fireEvent.press(screen.getByLabelText('Increase Warm-up'));
    expect(screen.getByLabelText('2 Warm-up')).toBeTruthy();
  });

  it('remove takes the exercise out', async () => {
    await open();
    await screen.findByText('New template');
    await addExercise('Bench Press');
    fireEvent.press(screen.getByLabelText('Remove Bench Press'));
    expect(screen.getByText('Exercises · 0')).toBeTruthy();
  });

  it('saves tpl_* with isBuiltIn false and the per-exercise plan, then goes back', async () => {
    await seed({ folders: [{ id: 'f_a', name: 'Folder A' }] });
    await open();
    await screen.findByText('New template');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Push A'), '  Push A  ');
    expect(screen.getByText('Folder')).toBeTruthy();
    fireEvent.press(screen.getByText('Folder A'));
    await addExercise('Bench Press');
    await addExercise('Barbell Squat');
    expect(screen.getByText('Hold and drag to rearrange')).toBeTruthy();
    fireEvent.press(screen.getAllByLabelText('Increase Sets')[1]);
    fireEvent.press(screen.getAllByLabelText('Increase Warm-up')[1]);
    fireEvent.press(screen.getByText('Save template'));
    expect(await screen.findByText('route:home')).toBeTruthy();
    const [saved] = await storedTemplates();
    expect(saved.id).toMatch(/^tpl_\d+_[a-z0-9]+$/);
    expect(saved).toMatchObject({
      name: 'Push A',
      isBuiltIn: false,
      folderId: 'f_a',
      exerciseIds: ['bench-press', 'squat'],
      exercises: [{ exerciseId: 'bench-press' }, { exerciseId: 'squat', sets: 4, warmUpSets: 1 }],
    });
  });
});

describe('edit', () => {
  const existing = customTemplate({
    id: 'tpl_e',
    name: 'Legs',
    folderId: 'f_a',
    exerciseIds: ['squat'],
    exercises: [{ exerciseId: 'squat', sets: 5 }],
  });

  it('prefills the form and saves changes in place', async () => {
    await seed({ templates: [existing], folders: [{ id: 'f_a', name: 'Folder A' }] });
    await open('?templateId=tpl_e');
    expect(await screen.findByText('Edit template')).toBeTruthy();
    expect(await screen.findByDisplayValue('Legs')).toBeTruthy();
    expect(screen.getByLabelText('5 Sets')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('Legs'), 'Leg day');
    fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByText('route:home')).toBeTruthy();
    const stored = await storedTemplates();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 'tpl_e', name: 'Leg day', folderId: 'f_a' });
    expect(stored[0].exercises).toEqual([{ exerciseId: 'squat', sets: 5 }]);
  });

  it('choosing None clears the folder', async () => {
    await seed({ templates: [existing], folders: [{ id: 'f_a', name: 'Folder A' }] });
    await open('?templateId=tpl_e');
    await screen.findByDisplayValue('Legs');
    fireEvent.press(screen.getByText('None'));
    fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByText('route:home')).toBeTruthy();
    expect((await storedTemplates())[0].folderId).toBeUndefined();
  });

  it('an unknown id shows Template not found and never creates a template', async () => {
    await seed({ templates: [existing] });
    await open('?templateId=tpl_missing');
    expect(await screen.findByText('Template not found')).toBeTruthy();
    expect(screen.queryByText('Save changes')).toBeNull();
    expect(await storedTemplates()).toHaveLength(1);
  });

  it('a built-in id shows Template not found', async () => {
    await open('?templateId=ppl-push');
    expect(await screen.findByText('Template not found')).toBeTruthy();
    expect(screen.queryByText('Save changes')).toBeNull();
    expect(useTemplatesStore.getState().userTemplates).toEqual([]);
  });
});

describe('save resilience', () => {
  it('a second tap while saving does not create a duplicate', async () => {
    await open();
    await screen.findByText('New template');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Push A'), 'Once');
    await addExercise('Bench Press');
    const save = screen.getByText('Save template');
    fireEvent.press(save);
    fireEvent.press(save);
    await waitFor(async () => expect(await storedTemplates()).toHaveLength(1));
  });
});
