import { create } from 'zustand';
import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';
import {
  getTemplates,
  setTemplates,
  getTemplateFolders,
  setTemplateFolders,
  getHiddenBuiltInTemplateIds,
  setHiddenBuiltInTemplateIds,
  getHiddenBuiltInFolderIds,
  setHiddenBuiltInFolderIds,
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
  toggleHiddenId,
} from '@/store/templatesLogic';
import { normalizeWorkoutTemplate } from '@/utils/templateExercises';

export interface TemplatesState {
  userTemplates: WorkoutTemplate[];
  folders: TemplateFolder[];
  /** Built-in template IDs soft-hidden locally (built-ins are not persisted). */
  hiddenBuiltInIds: string[];
  /** Built-in folder IDs soft-hidden locally — hides every template in that folder. */
  hiddenBuiltInFolderIds: string[];
  isLoading: boolean;
  load: () => Promise<void>;
  addTemplate: (t: WorkoutTemplate) => Promise<void>;
  updateTemplate: (id: string, t: Partial<WorkoutTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setTemplateHidden: (template: WorkoutTemplate, hidden: boolean) => Promise<void>;
  setBuiltInFolderHidden: (folderId: string, hidden: boolean) => Promise<void>;
  isTemplateHidden: (template: WorkoutTemplate) => boolean;
  addFolder: (f: TemplateFolder) => Promise<void>;
  updateFolder: (id: string, f: Partial<TemplateFolder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  /** All templates = built-in + user (built-in first) */
  allTemplates: () => WorkoutTemplate[];
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  userTemplates: [],
  folders: [],
  hiddenBuiltInIds: [],
  hiddenBuiltInFolderIds: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    try {
      const [userTemplates, folders, hiddenBuiltInIds, hiddenBuiltInFolderIds] = await Promise.all([
        getTemplates(),
        getTemplateFolders(),
        getHiddenBuiltInTemplateIds(),
        getHiddenBuiltInFolderIds(),
      ]);
      set({ userTemplates, folders, hiddenBuiltInIds, hiddenBuiltInFolderIds, isLoading: false });
    } catch {
      set({
        userTemplates: [],
        folders: [],
        hiddenBuiltInIds: [],
        hiddenBuiltInFolderIds: [],
        isLoading: false,
      });
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
    if (template.isBuiltIn) {
      const next = toggleHiddenId(get().hiddenBuiltInIds, template.id, hidden);
      set({ hiddenBuiltInIds: next });
      await setHiddenBuiltInTemplateIds(next);
      return;
    }
    await get().updateTemplate(template.id, { hidden });
  },

  setBuiltInFolderHidden: async (folderId, hidden) => {
    const next = toggleHiddenId(get().hiddenBuiltInFolderIds, folderId, hidden);
    set({ hiddenBuiltInFolderIds: next });
    await setHiddenBuiltInFolderIds(next);
  },

  isTemplateHidden: (template) =>
    isTemplateHidden(template, get().hiddenBuiltInIds, get().hiddenBuiltInFolderIds),

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
    const { folders: nextFolders, templates: nextTemplates } = deleteFolderCascade(
      get().folders,
      get().userTemplates,
      id
    );
    set({ folders: nextFolders, userTemplates: nextTemplates });
    await Promise.all([setTemplateFolders(nextFolders), setTemplates(nextTemplates)]);
    notifyFolderDelete(id);
    for (const t of nextTemplates) notifyTemplateUpsert(t);
  },

  allTemplates: () => computeAllTemplates(get().userTemplates),
}));
