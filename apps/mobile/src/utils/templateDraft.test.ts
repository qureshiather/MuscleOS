import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '@muscleos/types';
import {
  TEMPLATE_EXERCISES_REQUIRED,
  TEMPLATE_NAME_REQUIRED,
  buildTemplateSave,
  newTemplateId,
  validateTemplateDraft,
} from './templateDraft';

const plan = [
  { exerciseId: 'bench-press', sets: 3, warmUpSets: 0 },
  { exerciseId: 'squat', sets: 5, warmUpSets: 2 },
];

describe('validateTemplateDraft', () => {
  it('requires a non-empty name after trim', () => {
    expect(validateTemplateDraft('   ', plan)).toEqual({
      name: 'Name is required',
      exercises: null,
      valid: false,
    });
    expect(TEMPLATE_NAME_REQUIRED).toBe('Name is required');
  });

  it('requires at least one exercise', () => {
    expect(validateTemplateDraft('Push', [])).toEqual({
      name: null,
      exercises: 'Add at least one exercise',
      valid: false,
    });
    expect(TEMPLATE_EXERCISES_REQUIRED).toBe('Add at least one exercise');
  });

  it('reports both at once', () => {
    const r = validateTemplateDraft('', []);
    expect(r.name).toBe(TEMPLATE_NAME_REQUIRED);
    expect(r.exercises).toBe(TEMPLATE_EXERCISES_REQUIRED);
  });

  it('has no maximum name length or exercise cap', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ exerciseId: `e${i}`, sets: 3, warmUpSets: 0 }));
    expect(validateTemplateDraft('x'.repeat(500), many).valid).toBe(true);
  });
});

describe('buildTemplateSave', () => {
  const base = { name: '  Push A  ', plan, folderId: undefined, now: 1700000000000, rand: 'abc1234' };
  const existing: WorkoutTemplate = {
    id: 'tpl_1',
    name: 'Old',
    exerciseIds: ['row'],
    isBuiltIn: false,
    folderId: 'folder_1',
  };

  it('creates tpl_<timestamp>_<random>, isBuiltIn false, trimmed name, compact set plan', () => {
    const save = buildTemplateSave({ ...base, existing: null, isEditMode: false });
    expect(save).toEqual({
      kind: 'create',
      template: {
        id: 'tpl_1700000000000_abc1234',
        name: 'Push A',
        isBuiltIn: false,
        exerciseIds: ['bench-press', 'squat'],
        exercises: [{ exerciseId: 'bench-press' }, { exerciseId: 'squat', sets: 5, warmUpSets: 2 }],
      },
    });
    expect(newTemplateId(5, 'z')).toBe('tpl_5_z');
  });

  it('files a new template in the chosen folder', () => {
    const save = buildTemplateSave({ ...base, folderId: 'folder_2', existing: null, isEditMode: false });
    expect(save.kind === 'create' && save.template.folderId).toBe('folder_2');
  });

  it('edit mode updates name, exercises, and folder', () => {
    const save = buildTemplateSave({ ...base, folderId: 'folder_2', existing, isEditMode: true });
    expect(save).toEqual({
      kind: 'update',
      id: 'tpl_1',
      patch: {
        name: 'Push A',
        exerciseIds: ['bench-press', 'squat'],
        exercises: [{ exerciseId: 'bench-press' }, { exerciseId: 'squat', sets: 5, warmUpSets: 2 }],
        folderId: 'folder_2',
      },
    });
  });

  it('edit mode with None selected clears the folder (patch carries folderId: undefined)', () => {
    const save = buildTemplateSave({ ...base, folderId: undefined, existing, isEditMode: true });
    expect(save.kind).toBe('update');
    if (save.kind !== 'update') return;
    expect('folderId' in save.patch).toBe(true);
    expect(save.patch.folderId).toBeUndefined();
    // Merged the way the store merges a patch, the folder is gone.
    expect({ ...existing, ...save.patch }.folderId).toBeUndefined();
  });

  it('edit mode with no matching template is not-found — never a silent create', () => {
    expect(buildTemplateSave({ ...base, existing: undefined, isEditMode: true })).toEqual({
      kind: 'not-found',
    });
  });

  it('a built-in can never be the edit target', () => {
    const builtIn = { ...existing, id: 'ppl-push', isBuiltIn: true };
    expect(buildTemplateSave({ ...base, existing: builtIn, isEditMode: true }).kind).toBe('not-found');
  });
});
