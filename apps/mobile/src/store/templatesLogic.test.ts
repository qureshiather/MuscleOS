import { describe, expect, it } from 'vitest';
import type { TemplateFolder, WorkoutTemplate } from '@muscleos/types';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import {
  allTemplates,
  deleteFolderCascade,
  folderDeletePlan,
  groupHomeTemplates,
  isTemplateHidden,
  templateMenuActions,
  templatesInFolder,
  toggleHiddenId,
} from './templatesLogic';

const custom = (over: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id: 'tpl_1',
  name: 'My Split',
  exerciseIds: ['squat'],
  isBuiltIn: false,
  ...over,
});

describe('allTemplates', () => {
  it('lists built-ins first, then user templates', () => {
    const mine = custom({ id: 'tpl_x' });
    const all = allTemplates([mine]);
    expect(all.slice(0, BUILT_IN_TEMPLATES.length)).toEqual(BUILT_IN_TEMPLATES);
    expect(all.at(-1)).toBe(mine);
    expect(all).toHaveLength(BUILT_IN_TEMPLATES.length + 1);
  });
});

describe('toggleHiddenId', () => {
  it('adds an id when hiding and removes it when unhiding', () => {
    expect(toggleHiddenId([], 'ppl-push', true)).toEqual(['ppl-push']);
    expect(toggleHiddenId(['ppl-push'], 'ppl-push', false)).toEqual([]);
  });

  it('does not duplicate an already-hidden id', () => {
    expect(toggleHiddenId(['ppl-push'], 'ppl-push', true)).toEqual(['ppl-push']);
  });
});

describe('isTemplateHidden', () => {
  it('hides a built-in when its id is in the hidden list', () => {
    const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;
    expect(isTemplateHidden(push, ['ppl-push'], [])).toBe(true);
    expect(isTemplateHidden(push, [], [])).toBe(false);
  });

  it('hides a built-in when its whole folder is hidden', () => {
    const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;
    expect(isTemplateHidden(push, [], ['builtin_ppl'])).toBe(true);
  });

  it('hides a custom template only via its own hidden flag', () => {
    expect(isTemplateHidden(custom({ hidden: true }), [], [])).toBe(true);
    expect(isTemplateHidden(custom({ hidden: false }), ['tpl_1'], [])).toBe(false);
  });
});

describe('deleteFolderCascade', () => {
  const folders: TemplateFolder[] = [
    { id: 'f1', name: 'Push days' },
    { id: 'f2', name: 'Pull days' },
  ];
  const templates: WorkoutTemplate[] = [
    custom({ id: 't1', folderId: 'f1' }),
    custom({ id: 't2', folderId: 'f1' }),
    custom({ id: 't3', folderId: 'f2' }),
    custom({ id: 't4' }),
  ];

  it('removes the folder but keeps its templates, clearing their folderId', () => {
    const { folders: nextFolders, templates: nextTemplates } = deleteFolderCascade(folders, templates, 'f1');
    expect(nextFolders.map((f) => f.id)).toEqual(['f2']);
    // All four templates survive — none is deleted along with the folder.
    expect(nextTemplates).toHaveLength(4);
    expect(nextTemplates.find((t) => t.id === 't1')?.folderId).toBeUndefined();
    expect(nextTemplates.find((t) => t.id === 't2')?.folderId).toBeUndefined();
    // Templates in other folders are untouched.
    expect(nextTemplates.find((t) => t.id === 't3')?.folderId).toBe('f2');
  });

  it('does not mutate the inputs', () => {
    deleteFolderCascade(folders, templates, 'f1');
    expect(templates.find((t) => t.id === 't1')?.folderId).toBe('f1');
    expect(folders).toHaveLength(2);
  });
});

describe('templatesInFolder / folderDeletePlan', () => {
  const templates: WorkoutTemplate[] = [
    custom({ id: 't1', folderId: 'f1' }),
    custom({ id: 't2', folderId: 'f1', hidden: true }),
    custom({ id: 't3', folderId: 'f2' }),
    custom({ id: 't4' }),
  ];

  it('includes hidden templates in the folder', () => {
    expect(templatesInFolder(templates, 'f1').map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('counts hidden templates in the prompt and deletes them too', () => {
    const plan = folderDeletePlan({ id: 'f1', name: 'Push days' }, templates);
    expect(plan.templateIds).toEqual(['t1', 't2']);
    expect(plan.title).toBe('Delete folder');
    expect(plan.message).toBe(
      '"Push days" has 2 templates. Remove them from the folder or delete them?'
    );
  });

  it('uses the singular for one template, including a folder holding only a hidden one', () => {
    const plan = folderDeletePlan({ id: 'f9', name: 'Solo' }, [
      custom({ id: 'h', folderId: 'f9', hidden: true }),
    ]);
    expect(plan.templateIds).toEqual(['h']);
    expect(plan.message).toBe('"Solo" has 1 template. Remove them from the folder or delete them?');
  });

  it('asks a plain confirm for an empty folder', () => {
    const plan = folderDeletePlan({ id: 'empty', name: 'Empty' }, templates);
    expect(plan.templateIds).toEqual([]);
    expect(plan.message).toBe('Delete "Empty"?');
  });
});

describe('templateMenuActions', () => {
  const keys = (a: ReturnType<typeof templateMenuActions>) => a.map((x) => x.key);
  const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;

  it('built-ins only offer Hide (no rename / move / edit / delete)', () => {
    const actions = templateMenuActions(push, { isHidden: false, hiddenFolderIds: [], isPro: true });
    expect(actions).toEqual([{ key: 'hide', label: 'Hide', gate: null, locked: false }]);
  });

  it('an individually hidden built-in offers Unhide', () => {
    const actions = templateMenuActions(push, { isHidden: true, hiddenFolderIds: [], isPro: false });
    expect(actions).toEqual([{ key: 'unhide', label: 'Unhide', gate: null, locked: false }]);
  });

  it('a built-in hidden by its folder offers Unhide folder instead of a no-op Unhide', () => {
    const actions = templateMenuActions(push, {
      isHidden: true,
      hiddenFolderIds: ['builtin_ppl'],
      isPro: false,
    });
    expect(actions).toEqual([
      { key: 'unhide-folder', label: 'Unhide folder', gate: null, locked: false },
    ]);
  });

  it('customs offer Rename, Move, Edit (custom_templates), Hide, Delete (ungated) in order', () => {
    const actions = templateMenuActions(custom(), { isHidden: false, hiddenFolderIds: [], isPro: true });
    expect(keys(actions)).toEqual(['rename', 'move', 'edit', 'hide', 'delete']);
    expect(actions.map((a) => a.label)).toEqual(['Rename', 'Move', 'Edit', 'Hide', 'Delete']);
    expect(actions.map((a) => a.gate)).toEqual([
      'custom_templates',
      'custom_templates',
      'custom_templates',
      null,
      null,
    ]);
    expect(actions.every((a) => !a.locked)).toBe(true);
  });

  it('on Basic only the gated custom actions are locked', () => {
    const actions = templateMenuActions(custom({ hidden: true }), {
      isHidden: true,
      hiddenFolderIds: [],
      isPro: false,
    });
    expect(keys(actions)).toEqual(['rename', 'move', 'edit', 'unhide', 'delete']);
    expect(actions.map((a) => a.locked)).toEqual([true, true, true, false, false]);
  });

  it('a hidden custom never gets Unhide folder, even if its folder id is in the built-in list', () => {
    const actions = templateMenuActions(custom({ folderId: 'builtin_ppl', hidden: true }), {
      isHidden: true,
      hiddenFolderIds: ['builtin_ppl'],
      isPro: true,
    });
    expect(keys(actions)).toContain('unhide');
  });
});

describe('groupHomeTemplates', () => {
  const folders: TemplateFolder[] = [
    { id: 'normal', name: 'Normal' },
    { id: 'pinned', name: 'Pinned', favorite: true },
    { id: 'archived', name: 'Old', archived: true },
    { id: 'pinned-archived', name: 'Was pinned', favorite: true, archived: true },
    { id: 'all-hidden', name: 'All hidden' },
    { id: 'empty', name: 'Empty' },
  ];
  const mine: WorkoutTemplate[] = [
    custom({ id: 'loose' }),
    custom({ id: 'loose-hidden', hidden: true }),
    custom({ id: 'n1', folderId: 'normal' }),
    custom({ id: 'n2-hidden', folderId: 'normal', hidden: true }),
    custom({ id: 'p1', folderId: 'pinned' }),
    custom({ id: 'a1', folderId: 'archived' }),
    custom({ id: 'pa1', folderId: 'pinned-archived' }),
    custom({ id: 'h1', folderId: 'all-hidden', hidden: true }),
  ];

  function groupWith(hiddenIds: string[] = [], hiddenFolderIds: string[] = []) {
    return groupHomeTemplates({
      templates: allTemplates(mine),
      folders,
      isHidden: (t) => isTemplateHidden(t, hiddenIds, hiddenFolderIds),
      hiddenBuiltInFolderIds: hiddenFolderIds,
    });
  }

  it('custom: uncategorized, then pinned, normal, archived folders; all-hidden folders left out', () => {
    const { custom: c } = groupWith();
    expect(c.uncategorized.map((t) => t.id)).toEqual(['loose']);
    expect(c.pinnedFolders.map((g) => g.folder.id)).toEqual(['pinned']);
    expect(c.normalFolders.map((g) => g.folder.id)).toEqual(['normal', 'empty']);
    // Archived wins over pinned.
    expect(c.archivedFolders.map((g) => g.folder.id)).toEqual(['archived', 'pinned-archived']);
    expect(c.normalFolders[0].templates.map((t) => t.id)).toEqual(['n1']);
    expect(c.normalFolders[1].templates).toEqual([]);
  });

  it('custom: hidden templates (in or out of folders) go to the Hidden group', () => {
    const { custom: c } = groupWith();
    expect(c.hidden.map((t) => t.id)).toEqual(['loose-hidden', 'n2-hidden', 'h1']);
    expect(c.visibleCount).toBe(5);
  });

  it('built-in: every shipped folder with its templates by default; nothing hidden', () => {
    const { builtIn: b } = groupWith();
    expect(b.folders.map((g) => g.folder.id)).toEqual(['builtin_ppl', 'builtin_ul', 'builtin_sl']);
    expect(b.folders[0].templates.map((t) => t.id)).toEqual(['ppl-push', 'ppl-pull', 'ppl-legs']);
    expect(b.uncategorized).toEqual([]);
    expect(b.hiddenFolders).toEqual([]);
    expect(b.hiddenLoose).toEqual([]);
    expect(b.visibleCount).toBe(9);
    expect(b.hiddenCount).toBe(0);
  });

  it('built-in: a hidden folder moves whole into Hidden; a loose hidden template is listed alone', () => {
    const { builtIn: b } = groupWith(['ul-upper-a'], ['builtin_ppl']);
    expect(b.folders.map((g) => g.folder.id)).toEqual(['builtin_ul', 'builtin_sl']);
    expect(b.folders[0].templates.map((t) => t.id)).not.toContain('ul-upper-a');
    expect(b.hiddenFolders.map((g) => g.folder.id)).toEqual(['builtin_ppl']);
    expect(b.hiddenFolders[0].templates.map((t) => t.id)).toEqual([
      'ppl-push',
      'ppl-pull',
      'ppl-legs',
    ]);
    expect(b.hiddenLoose.map((t) => t.id)).toEqual(['ul-upper-a']);
    expect(b.hiddenCount).toBe(4);
  });

  it('built-in: a folder whose templates are all individually hidden is left out', () => {
    const { builtIn: b } = groupWith(['sl-a', 'sl-b']);
    expect(b.folders.map((g) => g.folder.id)).toEqual(['builtin_ppl', 'builtin_ul']);
    expect(b.hiddenFolders).toEqual([]);
    expect(b.hiddenLoose.map((t) => t.id)).toEqual(['sl-a', 'sl-b']);
  });
});
