import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutTemplate } from '@muscleos/types';

/**
 * templatesStore on the AsyncStorage harness (docs/features/templates.md): every write persists,
 * custom templates are normalized on write, legacy shapes migrate on load and are re-persisted,
 * built-in hiding is local-only while custom hiding is a synced record change, and folder CRUD
 * sends sync notifications only for what actually changed.
 */

vi.mock('@/sync', () => ({
  notifyTemplateUpsert: vi.fn(),
  notifyTemplateDelete: vi.fn(),
  notifyFolderUpsert: vi.fn(),
  notifyFolderDelete: vi.fn(),
}));

async function load() {
  vi.resetModules();
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  const { __resetAsyncStorage } = await import('@/test/mocks/asyncStorage');
  __resetAsyncStorage();
  const { STORAGE_KEYS } = await import('@/storage/keys');
  const sync = await import('@/sync');
  const { useTemplatesStore } = await import('./templatesStore');
  const read = async (key: string) => {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  };
  return { AsyncStorage, STORAGE_KEYS, sync: vi.mocked(sync), store: useTemplatesStore, read };
}

const custom = (over: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id: 'tpl_1',
  name: 'Mine',
  exerciseIds: ['squat'],
  isBuiltIn: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('load', () => {
  it('starts loading and empty, then reads every key', async () => {
    const { AsyncStorage, STORAGE_KEYS, store } = await load();
    expect(store.getState().isLoading).toBe(true);
    await AsyncStorage.setItem(STORAGE_KEYS.templates, JSON.stringify([custom()]));
    await AsyncStorage.setItem(STORAGE_KEYS.templateFolders, JSON.stringify([{ id: 'f', name: 'F' }]));
    await AsyncStorage.setItem(STORAGE_KEYS.hiddenBuiltInTemplateIds, JSON.stringify(['ppl-push']));
    await AsyncStorage.setItem(STORAGE_KEYS.hiddenBuiltInFolderIds, JSON.stringify(['builtin_sl']));
    await store.getState().load();
    const s = store.getState();
    expect(s.isLoading).toBe(false);
    expect(s.userTemplates.map((t) => t.id)).toEqual(['tpl_1']);
    expect(s.folders).toEqual([{ id: 'f', name: 'F' }]);
    expect(s.hiddenBuiltInIds).toEqual(['ppl-push']);
    expect(s.hiddenBuiltInFolderIds).toEqual(['builtin_sl']);
  });

  it('migrates legacy defaultSets to per-exercise sets and persists the migration', async () => {
    const { AsyncStorage, STORAGE_KEYS, store, read } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.templates,
      JSON.stringify([{ id: 'tpl_old', name: 'Old', exerciseIds: ['squat', 'bench-press'], defaultSets: 5 }])
    );
    await store.getState().load();
    const expected = {
      id: 'tpl_old',
      name: 'Old',
      exerciseIds: ['squat', 'bench-press'],
      exercises: [
        { exerciseId: 'squat', sets: 5 },
        { exerciseId: 'bench-press', sets: 5 },
      ],
    };
    expect(store.getState().userTemplates).toEqual([expected]);
    expect(await read(STORAGE_KEYS.templates)).toEqual([expected]);
  });

  it('migrates legacy days[] templates and persists them', async () => {
    const { AsyncStorage, STORAGE_KEYS, store, read } = await load();
    await AsyncStorage.setItem(
      STORAGE_KEYS.templates,
      JSON.stringify([
        { id: 'tpl_days', name: 'Days', days: [{ name: 'A', exerciseIds: ['squat', 'deadlift'] }] },
      ])
    );
    await store.getState().load();
    const [t] = store.getState().userTemplates;
    expect(t.id).toBe('tpl_days');
    expect(t.exerciseIds).toEqual(['squat', 'deadlift']);
    expect(t).not.toHaveProperty('days');
    const persisted = await read(STORAGE_KEYS.templates);
    expect(persisted[0]).not.toHaveProperty('days');
    expect(persisted[0].exerciseIds).toEqual(['squat', 'deadlift']);
  });

  it('falls back to empty lists on corrupt storage', async () => {
    const { AsyncStorage, STORAGE_KEYS, store } = await load();
    await AsyncStorage.setItem(STORAGE_KEYS.templates, '{not json');
    await store.getState().load();
    expect(store.getState().userTemplates).toEqual([]);
    expect(store.getState().isLoading).toBe(false);
  });
});

describe('custom template CRUD', () => {
  it('addTemplate normalizes on write, persists, and notifies sync', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addTemplate(
      custom({
        defaultSets: 4,
        exercises: [{ exerciseId: 'squat', sets: 3, warmUpSets: 0 }],
      })
    );
    const expected = { id: 'tpl_1', name: 'Mine', exerciseIds: ['squat'], exercises: [{ exerciseId: 'squat' }], isBuiltIn: false };
    expect(store.getState().userTemplates).toEqual([expected]);
    expect(await read(STORAGE_KEYS.templates)).toEqual([expected]);
    expect(sync.notifyTemplateUpsert).toHaveBeenCalledWith(expected);
  });

  it('updateTemplate merges, normalizes, persists, and notifies only the updated template', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addTemplate(custom());
    await store.getState().addTemplate(custom({ id: 'tpl_2', name: 'Other' }));
    vi.clearAllMocks();
    await store.getState().updateTemplate('tpl_1', { name: 'Renamed', folderId: 'f1' });
    const persisted = await read(STORAGE_KEYS.templates);
    expect(persisted[0]).toMatchObject({ id: 'tpl_1', name: 'Renamed', folderId: 'f1' });
    expect(persisted[1].name).toBe('Other');
    expect(sync.notifyTemplateUpsert).toHaveBeenCalledTimes(1);
    expect(sync.notifyTemplateUpsert.mock.calls[0][0].id).toBe('tpl_1');
  });

  it('updateTemplate with folderId: undefined clears the folder', async () => {
    const { STORAGE_KEYS, store, read } = await load();
    await store.getState().addTemplate(custom({ folderId: 'f1' }));
    await store.getState().updateTemplate('tpl_1', { folderId: undefined });
    expect(store.getState().userTemplates[0]).not.toHaveProperty('folderId');
    expect((await read(STORAGE_KEYS.templates))[0]).not.toHaveProperty('folderId');
  });

  it('deleteTemplate removes, persists, and notifies a delete', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addTemplate(custom());
    await store.getState().deleteTemplate('tpl_1');
    expect(store.getState().userTemplates).toEqual([]);
    expect(await read(STORAGE_KEYS.templates)).toEqual([]);
    expect(sync.notifyTemplateDelete).toHaveBeenCalledWith('tpl_1');
  });

  it('allTemplates lists built-ins first, then customs', async () => {
    const { store } = await load();
    await store.getState().addTemplate(custom());
    const all = store.getState().allTemplates();
    expect(all[0].isBuiltIn).toBe(true);
    expect(all.at(-1)?.id).toBe('tpl_1');
  });
});

describe('soft hide', () => {
  it('hiding a built-in writes the local id list and never notifies sync', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    const push = store.getState().allTemplates().find((t) => t.id === 'ppl-push')!;
    await store.getState().setTemplateHidden(push, true);
    expect(store.getState().hiddenBuiltInIds).toEqual(['ppl-push']);
    expect(await read(STORAGE_KEYS.hiddenBuiltInTemplateIds)).toEqual(['ppl-push']);
    expect(store.getState().isTemplateHidden(push)).toBe(true);
    await store.getState().setTemplateHidden(push, false);
    expect(await read(STORAGE_KEYS.hiddenBuiltInTemplateIds)).toEqual([]);
    expect(sync.notifyTemplateUpsert).not.toHaveBeenCalled();
  });

  it('hiding a built-in folder hides every template in it, locally only', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().setBuiltInFolderHidden('builtin_ppl', true);
    expect(await read(STORAGE_KEYS.hiddenBuiltInFolderIds)).toEqual(['builtin_ppl']);
    const ppl = store.getState().allTemplates().filter((t) => t.folderId === 'builtin_ppl');
    expect(ppl.every((t) => store.getState().isTemplateHidden(t))).toBe(true);
    await store.getState().setBuiltInFolderHidden('builtin_ppl', false);
    expect(await read(STORAGE_KEYS.hiddenBuiltInFolderIds)).toEqual([]);
    expect(sync.notifyFolderUpsert).not.toHaveBeenCalled();
  });

  it('hiding a custom sets hidden on the record, which syncs', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addTemplate(custom());
    vi.clearAllMocks();
    await store.getState().setTemplateHidden(store.getState().userTemplates[0], true);
    expect((await read(STORAGE_KEYS.templates))[0].hidden).toBe(true);
    expect(sync.notifyTemplateUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'tpl_1', hidden: true }));
    expect(await read(STORAGE_KEYS.hiddenBuiltInTemplateIds)).toBeNull();
    await store.getState().setTemplateHidden(store.getState().userTemplates[0], false);
    expect((await read(STORAGE_KEYS.templates))[0]).not.toHaveProperty('hidden');
  });
});

describe('folders', () => {
  it('add / update persist and notify a folder upsert', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addFolder({ id: 'f1', name: 'Push' });
    await store.getState().updateFolder('f1', { favorite: true, name: 'Push days' });
    await store.getState().updateFolder('f1', { archived: true });
    expect(await read(STORAGE_KEYS.templateFolders)).toEqual([
      { id: 'f1', name: 'Push days', favorite: true, archived: true },
    ]);
    expect(sync.notifyFolderUpsert).toHaveBeenCalledTimes(3);
  });

  it('deleteFolder keeps the templates, clears their folder, and upserts only those', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addFolder({ id: 'f1', name: 'Push' });
    await store.getState().addTemplate(custom({ id: 'in', folderId: 'f1' }));
    await store.getState().addTemplate(custom({ id: 'in-hidden', folderId: 'f1', hidden: true }));
    await store.getState().addTemplate(custom({ id: 'out' }));
    vi.clearAllMocks();
    await store.getState().deleteFolder('f1');
    expect(await read(STORAGE_KEYS.templateFolders)).toEqual([]);
    const persisted: WorkoutTemplate[] = await read(STORAGE_KEYS.templates);
    expect(persisted.map((t) => t.id)).toEqual(['in', 'in-hidden', 'out']);
    expect(persisted.every((t) => t.folderId == null)).toBe(true);
    expect(sync.notifyFolderDelete).toHaveBeenCalledWith('f1');
    expect(sync.notifyTemplateUpsert.mock.calls.map((c) => c[0].id).sort()).toEqual(['in', 'in-hidden']);
  });

  it('deleteFolderAndTemplates deletes every template in the folder, hidden ones included', async () => {
    const { STORAGE_KEYS, store, read, sync } = await load();
    await store.getState().addFolder({ id: 'f1', name: 'Push' });
    await store.getState().addTemplate(custom({ id: 'in', folderId: 'f1' }));
    await store.getState().addTemplate(custom({ id: 'in-hidden', folderId: 'f1', hidden: true }));
    await store.getState().addTemplate(custom({ id: 'out' }));
    vi.clearAllMocks();
    await store.getState().deleteFolderAndTemplates('f1');
    expect(store.getState().userTemplates.map((t) => t.id)).toEqual(['out']);
    expect((await read(STORAGE_KEYS.templates)).map((t: WorkoutTemplate) => t.id)).toEqual(['out']);
    expect(await read(STORAGE_KEYS.templateFolders)).toEqual([]);
    expect(sync.notifyTemplateDelete.mock.calls.map((c) => c[0]).sort()).toEqual(['in', 'in-hidden']);
    expect(sync.notifyFolderDelete).toHaveBeenCalledWith('f1');
    expect(sync.notifyTemplateUpsert).not.toHaveBeenCalled();
  });
});
