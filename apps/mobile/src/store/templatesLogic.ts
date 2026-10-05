import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';
import { BUILT_IN_FOLDERS, BUILT_IN_TEMPLATES, isBuiltInHidden } from '@/data/builtInTemplates';

/**
 * Pure reducers for the templates store (docs/features/templates.md). Built-in templates are
 * immutable and always listed first; hiding is soft and folder deletion never deletes the
 * templates inside it. Keeping this logic RN-free lets it be unit-tested.
 */

/** All templates = built-in + user, built-ins first. */
export function allTemplates(userTemplates: readonly WorkoutTemplate[]): WorkoutTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...userTemplates];
}

/** Add or remove an id from a soft-hidden list, keeping it de-duplicated. */
export function toggleHiddenId(ids: readonly string[], id: string, hidden: boolean): string[] {
  const set = new Set(ids);
  if (hidden) set.add(id);
  else set.delete(id);
  return [...set];
}

/** Whether a template is hidden: soft-hidden built-in (by id or folder), or a custom `hidden` flag. */
export function isTemplateHidden(
  template: WorkoutTemplate,
  hiddenBuiltInIds: readonly string[],
  hiddenBuiltInFolderIds: readonly string[]
): boolean {
  if (template.isBuiltIn) {
    return isBuiltInHidden(template, hiddenBuiltInIds, hiddenBuiltInFolderIds);
  }
  return template.hidden === true;
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
        : `"${folder.name}" has ${n} template${n === 1 ? '' : 's'}. Remove them from the folder or delete them?`,
  };
}

export type TemplateMenuActionKey =
  | 'rename'
  | 'move'
  | 'edit'
  | 'hide'
  | 'unhide'
  | 'unhide-folder'
  | 'delete';

export type TemplateMenuAction = {
  key: TemplateMenuActionKey;
  label: string;
};

/**
 * The template card's context menu (docs/features/templates.md#context-menus). Built-ins only get
 * Hide / Unhide; customs get Rename, Move, Edit, Hide / Unhide, and Delete.
 *
 * A built-in hidden because its **whole folder** is hidden can't be unhidden on its own (the
 * folder would keep hiding it), so its menu offers **Unhide folder** instead.
 */
export function templateMenuActions(
  template: Pick<WorkoutTemplate, 'isBuiltIn' | 'folderId'>,
  opts: { isHidden: boolean; hiddenFolderIds: readonly string[] }
): TemplateMenuAction[] {
  const item = (key: TemplateMenuActionKey, label: string): TemplateMenuAction => ({ key, label });
  const hiddenByFolder =
    template.isBuiltIn === true &&
    template.folderId != null &&
    opts.hiddenFolderIds.includes(template.folderId);
  const visibility = !opts.isHidden
    ? item('hide', 'Hide')
    : hiddenByFolder
      ? item('unhide-folder', 'Unhide folder')
      : item('unhide', 'Unhide');
  if (template.isBuiltIn) return [visibility];
  return [
    item('rename', 'Rename'),
    item('move', 'Move'),
    item('edit', 'Edit'),
    visibility,
    item('delete', 'Delete'),
  ];
}

export type FolderGroup = { folder: TemplateFolder; templates: WorkoutTemplate[] };

export type HomeTemplateGroups = {
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
  builtIn: {
    uncategorized: WorkoutTemplate[];
    /** Built-in folders with at least one visible template. */
    folders: FolderGroup[];
    /** Built-in folders hidden as a whole, listed with every template in them. */
    hiddenFolders: FolderGroup[];
    /** Hidden built-ins that aren't inside a hidden folder. */
    hiddenLoose: WorkoutTemplate[];
    visibleCount: number;
    hiddenCount: number;
  };
};

/**
 * Splits the home list into the Custom and Built-in sections
 * (docs/features/templates.md#home-screen). A folder whose templates are **all hidden** is left
 * out (they show under Hidden instead); an empty custom folder still shows.
 */
export function groupHomeTemplates(args: {
  templates: readonly WorkoutTemplate[];
  folders: readonly TemplateFolder[];
  isHidden: (template: WorkoutTemplate) => boolean;
  hiddenBuiltInFolderIds: readonly string[];
  builtInFolders?: readonly TemplateFolder[];
}): HomeTemplateGroups {
  const { templates, folders, isHidden, hiddenBuiltInFolderIds } = args;
  const builtInFolders = args.builtInFolders ?? BUILT_IN_FOLDERS;
  const custom: WorkoutTemplate[] = [];
  const hiddenCustom: WorkoutTemplate[] = [];
  const builtIn: WorkoutTemplate[] = [];
  const hiddenBuiltIn: WorkoutTemplate[] = [];
  for (const t of templates) {
    const hidden = isHidden(t);
    if (t.isBuiltIn) (hidden ? hiddenBuiltIn : builtIn).push(t);
    else (hidden ? hiddenCustom : custom).push(t);
  }

  const onlyHidden = (folderId: string) =>
    !custom.some((t) => t.folderId === folderId) &&
    hiddenCustom.some((t) => t.folderId === folderId);
  const group = (folder: TemplateFolder): FolderGroup => ({
    folder,
    templates: custom.filter((t) => t.folderId === folder.id),
  });
  const shown = folders.filter((f) => !onlyHidden(f.id));

  return {
    custom: {
      uncategorized: custom.filter((t) => !t.folderId),
      pinnedFolders: shown.filter((f) => !f.archived && f.favorite).map(group),
      normalFolders: shown.filter((f) => !f.archived && !f.favorite).map(group),
      archivedFolders: shown.filter((f) => f.archived).map(group),
      hidden: hiddenCustom,
      visibleCount: custom.length,
    },
    builtIn: {
      uncategorized: builtIn.filter((t) => !t.folderId),
      folders: builtInFolders
        .map((folder) => ({ folder, templates: builtIn.filter((t) => t.folderId === folder.id) }))
        .filter((g) => g.templates.length > 0),
      hiddenFolders: builtInFolders
        .filter((f) => hiddenBuiltInFolderIds.includes(f.id))
        .map((folder) => ({
          folder,
          templates: templates.filter((t) => t.isBuiltIn && t.folderId === folder.id),
        })),
      hiddenLoose: hiddenBuiltIn.filter(
        (t) => !t.folderId || !hiddenBuiltInFolderIds.includes(t.folderId)
      ),
      visibleCount: builtIn.length,
      hiddenCount: hiddenBuiltIn.length,
    },
  };
}
