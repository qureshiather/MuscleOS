import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';
import { BUILT_IN_TEMPLATES, isBuiltInHidden } from '@/data/builtInTemplates';

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
