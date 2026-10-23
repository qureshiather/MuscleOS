import { describe, expect, it } from 'vitest';
import type { TemplateFolder, WorkoutTemplate } from '@muscleos/types';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import {
  allTemplates,
  deleteFolderCascade,
  folderDeletePlan,
  groupYourWorkouts,
  isTemplateHidden,
  templateMenuActions,
  templatesInFolder,
  yourWorkoutTemplates,
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

describe('isTemplateHidden', () => {
  it('hides a custom template only via its own hidden flag', () => {
    expect(isTemplateHidden(custom({ hidden: true }))).toBe(true);
    expect(isTemplateHidden(custom({ hidden: false }))).toBe(false);
    expect(isTemplateHidden(custom())).toBe(false);
  });

  it('never hides a built-in — they leave Your workouts with their program', () => {
    const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;
    expect(isTemplateHidden(push)).toBe(false);
    expect(isTemplateHidden({ ...push, hidden: true })).toBe(false);
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
      '"Push days" has 2 templates. Keep them outside the folder, or delete them too?'
    );
  });

  it('uses the singular for one template, including a folder holding only a hidden one', () => {
    const plan = folderDeletePlan({ id: 'f9', name: 'Solo' }, [
      custom({ id: 'h', folderId: 'f9', hidden: true }),
    ]);
    expect(plan.templateIds).toEqual(['h']);
    expect(plan.message).toBe('"Solo" has 1 template. Keep it outside the folder, or delete it too?');
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

  it('program templates have no menu', () => {
    expect(templateMenuActions(push, { isHidden: false })).toEqual([]);
  });

  it('customs offer Rename, Move, Edit, Hide, Delete in order', () => {
    const actions = templateMenuActions(custom(), { isHidden: false });
    expect(keys(actions)).toEqual(['rename', 'move', 'edit', 'hide', 'delete']);
    expect(actions.map((a) => a.label)).toEqual(['Rename', 'Move', 'Edit', 'Hide', 'Delete']);
  });

  it('a hidden custom offers Unhide in place of Hide', () => {
    const actions = templateMenuActions(custom({ hidden: true }), { isHidden: true });
    expect(keys(actions)).toEqual(['rename', 'move', 'edit', 'unhide', 'delete']);
  });
});

describe('groupYourWorkouts', () => {
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
  const group = (activeProgramId: string | null = null) =>
    groupYourWorkouts({ userTemplates: mine, folders, activeProgramId });

  it('custom: uncategorized, then pinned, normal, archived folders; all-hidden folders left out', () => {
    const { custom: c } = group();
    expect(c.uncategorized.map((t) => t.id)).toEqual(['loose']);
    expect(c.pinnedFolders.map((g) => g.folder.id)).toEqual(['pinned']);
    expect(c.normalFolders.map((g) => g.folder.id)).toEqual(['normal', 'empty']);
    // Archived wins over pinned.
    expect(c.archivedFolders.map((g) => g.folder.id)).toEqual(['archived', 'pinned-archived']);
    expect(c.normalFolders[0].templates.map((t) => t.id)).toEqual(['n1']);
    expect(c.normalFolders[1].templates).toEqual([]);
  });

  it('custom: hidden templates (in or out of folders) go to the Hidden group', () => {
    const { custom: c } = group();
    expect(c.hidden.map((t) => t.id)).toEqual(['loose-hidden', 'n2-hidden', 'h1']);
    expect(c.visibleCount).toBe(5);
  });

  it('with no program, no built-in appears', () => {
    expect(group().program).toBeNull();
  });

  it('the chosen program brings exactly its templates, in shipped order', () => {
    const { program } = group('builtin_ppl');
    expect(program?.program.name).toBe('Push Pull Legs');
    expect(program?.templates.map((t) => t.id)).toEqual(['ppl-push', 'ppl-pull', 'ppl-legs']);
  });

  it('an unknown program id means no program', () => {
    expect(group('builtin_gone').program).toBeNull();
  });
});

describe('yourWorkoutTemplates', () => {
  const mine = [custom({ id: 'mine' }), custom({ id: 'gone', hidden: true })];

  it('is just your visible templates with no program', () => {
    const ids = yourWorkoutTemplates({ userTemplates: mine, activeProgramId: null }).map((t) => t.id);
    expect(ids).toEqual(['mine']);
  });

  it('adds the chosen program, and only that program', () => {
    const ids = yourWorkoutTemplates({ userTemplates: mine, activeProgramId: 'builtin_sl' }).map(
      (t) => t.id
    );
    expect(ids).toEqual(['sl-a', 'sl-b', 'mine']);
  });
});
