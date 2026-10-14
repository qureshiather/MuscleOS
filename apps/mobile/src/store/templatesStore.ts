import { create } from 'zustand';
import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';
import {
  getTemplates,
  setTemplates,
  getTemplateFolders,
  setTemplateFolders,
} from '@/storage/localStorage';
import {
  notifyTemplateUpsert,
  notifyTemplateDelete,
  notifyFolderUpsert,
  notifyFolderDelete,
} from '@/sync';
import {
  allTemplates as computeAllTemplates,
  deleteFolderCascade,
  isTemplateHidden,
  templatesInFolder,
} from '@/store/templatesLogic';
import { normalizeWorkoutTemplate } from '@/utils/templateExercises';

export interface TemplatesState {
  userTemplates: WorkoutTemplate[];
  folders: TemplateFolder[];
  isLoading: boolean;
  load: () => Promise<void>;
  addTemplate: (t: WorkoutTemplate) => Promise<void>;
  updateTemplate: (id: string, t: Partial<WorkoutTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  /** Custom templates only; built-ins can't be hidden. */
  setTemplateHidden: (template: WorkoutTemplate, hidden: boolean) => Promise<void>;
  isTemplateHidden: (template: WorkoutTemplate) => boolean;
  addFolder: (f: TemplateFolder) => Promise<void>;
  updateFolder: (id: string, f: Partial<TemplateFolder>) => Promise<void>;
  /** Delete a folder, keeping its templates (their `folderId` is cleared). */
  deleteFolder: (id: string) => Promise<void>;
  /** Delete a folder and every template filed in it, hidden ones included. */
  deleteFolderAndTemplates: (id: string) => Promise<void>;
  /** All templates = built-in + user (built-in first) */
  allTemplates: () => WorkoutTemplate[];
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  userTemplates: [],
  folders: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    try {
      const [userTemplates, folders] = await Promise.all([getTemplates(), getTemplateFolders()]);
      set({ userTemplates, folders, isLoading: false });
    } catch {
      set({ userTemplates: [], folders: [], isLoading: false });
    }
  },

  addTemplate: async (t) => {
    const normalized = normalizeWorkoutTemplate(t);
    const next = [...get().userTemplates, normalized];
    set({ userTemplates: next });
    await setTemplates(next);
    notifyTemplateUpsert(normalized);
  },

  updateTemplate: async (id, patch) => {
    const next = get().userTemplates.map((t) =>
      t.id === id ? normalizeWorkoutTemplate({ ...t, ...patch }) : t
    );
    set({ userTemplates: next });
    await setTemplates(next);
    const updated = next.find((t) => t.id === id);
    if (updated) notifyTemplateUpsert(updated);
  },

  deleteTemplate: async (id) => {
    const next = get().userTemplates.filter((t) => t.id !== id);
    set({ userTemplates: next });
    await setTemplates(next);
    notifyTemplateDelete(id);
  },

  setTemplateHidden: async (template, hidden) => {
    if (template.isBuiltIn) return;
    await get().updateTemplate(template.id, { hidden });
  },

  isTemplateHidden: (template) => isTemplateHidden(template),

  addFolder: async (f) => {
    const next = [...get().folders, f];
    set({ folders: next });
    await setTemplateFolders(next);
    notifyFolderUpsert(f);
  },

  updateFolder: async (id, patch) => {
    const next = get().folders.map((f) => (f.id === id ? { ...f, ...patch } : f));
    set({ folders: next });
    await setTemplateFolders(next);
    const updated = next.find((f) => f.id === id);
    if (updated) notifyFolderUpsert(updated);
  },

  deleteFolder: async (id) => {
    const affectedIds = new Set(templatesInFolder(get().userTemplates, id).map((t) => t.id));
    const { folders: nextFolders, templates: nextTemplates } = deleteFolderCascade(
      get().folders,
      get().userTemplates,
      id
    );
    set({ folders: nextFolders, userTemplates: nextTemplates });
    await Promise.all([setTemplateFolders(nextFolders), setTemplates(nextTemplates)]);
    notifyFolderDelete(id);
    // Only templates that were in the folder changed (their folderId was cleared).
    for (const t of nextTemplates) if (affectedIds.has(t.id)) notifyTemplateUpsert(t);
  },

  deleteFolderAndTemplates: async (id) => {
    const ids = new Set(templatesInFolder(get().userTemplates, id).map((t) => t.id));
    const nextTemplates = get().userTemplates.filter((t) => !ids.has(t.id));
    const nextFolders = get().folders.filter((f) => f.id !== id);
    set({ userTemplates: nextTemplates, folders: nextFolders });
    await Promise.all([setTemplates(nextTemplates), setTemplateFolders(nextFolders)]);
    for (const templateId of ids) notifyTemplateDelete(templateId);
    notifyFolderDelete(id);
  },

  allTemplates: () => computeAllTemplates(get().userTemplates),
}));
