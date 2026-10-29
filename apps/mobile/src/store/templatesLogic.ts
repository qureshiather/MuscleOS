import type { BuiltInProgram, WorkoutTemplate, TemplateFolder } from '@muscleos/types';
import { BUILT_IN_TEMPLATES, builtInProgram, programTemplates } from '@/data/builtInTemplates';

/**
 * Pure reducers for the templates store (docs/features/templates.md). Built-in templates are
 * immutable and always listed first; they reach Your workouts only as the one chosen program.
 * Hiding a custom template is soft, and folder deletion never deletes the templates inside it. Keeping this logic RN-free lets it be unit-tested.
 */

/** All templates = built-in + user, built-ins first. */
export function allTemplates(userTemplates: readonly WorkoutTemplate[]): WorkoutTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...userTemplates];
}

/** Only custom templates can be hidden; built-ins leave Your workouts with their program. */
export function isTemplateHidden(template: Pick<WorkoutTemplate, 'isBuiltIn' | 'hidden'>): boolean {
  return template.isBuiltIn !== true && template.hidden === true;
}

/**
 * Deleting a custom folder removes the folder but keeps its templates, clearing their `folderId`
 * so they fall back to the uncategorized group rather than being deleted.
 */
export function deleteFolderCascade(
  folders: readonly TemplateFolder[],
  templates: readonly WorkoutTemplate[],
  folderId: string
): { folders: TemplateFolder[]; templates: WorkoutTemplate[] } {
  return {
    folders: folders.filter((f) => f.id !== folderId),
    templates: templates.map((t) => (t.folderId === folderId ? { ...t, folderId: undefined } : t)),
  };
}

/** Custom templates filed in `folderId`, hidden ones included. */
export function templatesInFolder(
  templates: readonly WorkoutTemplate[],
  folderId: string
): WorkoutTemplate[] {
  return templates.filter((t) => t.folderId === folderId);
}

/**
 * What "Delete folder" acts on: every custom template filed in the folder, **including hidden
 * ones** — the prompt's count and "Delete folder and templates" both use this list, so a hidden
 * template can't outlive its folder's delete-everything choice.
 */
export function folderDeletePlan(
  folder: Pick<TemplateFolder, 'id' | 'name'>,
  templates: readonly WorkoutTemplate[]
): { templateIds: string[]; title: string; message: string } {
  const templateIds = templatesInFolder(templates, folder.id).map((t) => t.id);
  const n = templateIds.length;
  return {
    templateIds,
    title: 'Delete folder',
    message:
      n === 0
        ? `Delete "${folder.name}"?`
        : n === 1
          ? `"${folder.name}" has 1 template. Keep it outside the folder, or delete it too?`
          : `"${folder.name}" has ${n} templates. Keep them outside the folder, or delete them too?`,
  };
}

export type TemplateMenuActionKey =
  | 'rename'
  | 'move'
  | 'edit'
  | 'hide'
  | 'unhide'
  | 'delete';

export type TemplateMenuAction = {
  key: TemplateMenuActionKey;
  label: string;
};

/**
 * The template card's context menu (docs/features/templates.md#context-menus). Custom templates
 * get Rename, Move, Edit, Hide / Unhide, and Delete. Program templates have no menu: a program
 * joins and leaves Your workouts as a whole.
 */
export function templateMenuActions(
  template: Pick<WorkoutTemplate, 'isBuiltIn'>,
  opts: { isHidden: boolean }
): TemplateMenuAction[] {
  if (template.isBuiltIn) return [];
  const item = (key: TemplateMenuActionKey, label: string): TemplateMenuAction => ({ key, label });
  return [
    item('rename', 'Rename'),
    item('move', 'Move'),
    item('edit', 'Edit'),
    opts.isHidden ? item('unhide', 'Unhide') : item('hide', 'Hide'),
    item('delete', 'Delete'),
  ];
}

export type FolderGroup = { folder: TemplateFolder; templates: WorkoutTemplate[] };

export type YourWorkouts = {
  /** The chosen program and its templates, or null when no program is chosen. */
  program: { program: BuiltInProgram; templates: WorkoutTemplate[] } | null;
  custom: {
    /** Visible custom templates with no folder. */
    uncategorized: WorkoutTemplate[];
    /** Pinned (`favorite`) folders, then normal, then archived — storage order within each. */
    pinnedFolders: FolderGroup[];
    normalFolders: FolderGroup[];
    archivedFolders: FolderGroup[];
    /** Hidden custom templates, in or out of folders. */
    hidden: WorkoutTemplate[];
    visibleCount: number;
  };
};

/**
 * Your workouts (docs/features/templates.md#your-workouts): at most one built-in program, then
 * your custom templates grouped into folders. A folder whose templates are **all hidden** is
 * left out (they show under Hidden instead); an empty custom folder still shows.
 */
export function groupYourWorkouts(args: {
  userTemplates: readonly WorkoutTemplate[];
  folders: readonly TemplateFolder[];
  activeProgramId: string | null;
}): YourWorkouts {
  const { userTemplates, folders } = args;
  const custom = userTemplates.filter((t) => !isTemplateHidden(t));
  const hidden = userTemplates.filter((t) => isTemplateHidden(t));

  const onlyHidden = (folderId: string) =>
    !custom.some((t) => t.folderId === folderId) && hidden.some((t) => t.folderId === folderId);
  const group = (folder: TemplateFolder): FolderGroup => ({
    folder,
    templates: custom.filter((t) => t.folderId === folder.id),
  });
  const shown = folders.filter((f) => !onlyHidden(f.id));
  const known = (t: WorkoutTemplate) => existingFolderId(t.folderId, folders) != null;
  const program = builtInProgram(args.activeProgramId);

  return {
    program: program ? { program, templates: programTemplates(program.id) } : null,
    custom: {
      // A folder deleted on another device can leave a template pointing at nothing: list it here.
      uncategorized: custom.filter((t) => !known(t)),
      pinnedFolders: shown.filter((f) => !f.archived && f.favorite).map(group),
      normalFolders: shown.filter((f) => !f.archived && !f.favorite).map(group),
      archivedFolders: shown.filter((f) => f.archived).map(group),
      hidden,
      visibleCount: custom.length,
    },
  };
}

/** `folderId` if that folder still exists, else undefined (the template counts as uncategorized). */
export function existingFolderId(
  folderId: string | undefined,
  folders: readonly Pick<TemplateFolder, 'id'>[]
): string | undefined {
  return folderId && folders.some((f) => f.id === folderId) ? folderId : undefined;
}

/** Every template in Your workouts — the program's, then visible custom ones. Suggested picks from these. */
export function yourWorkoutTemplates(args: {
  userTemplates: readonly WorkoutTemplate[];
  activeProgramId: string | null;
}): WorkoutTemplate[] {
  const program = builtInProgram(args.activeProgramId);
  return [
    ...(program ? programTemplates(program.id) : []),
    ...args.userTemplates.filter((t) => !isTemplateHidden(t)),
  ];
}
