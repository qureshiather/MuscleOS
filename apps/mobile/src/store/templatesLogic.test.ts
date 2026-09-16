import { describe, expect, it } from 'vitest';
import type { TemplateFolder, WorkoutTemplate } from '@muscleos/types';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import {
  allTemplates,
  deleteFolderCascade,
  isTemplateHidden,
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
